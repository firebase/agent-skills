# Firebase AI Logic - Android Setup Guide (Kotlin)

This guide covers enabling, adding, and initializing the Firebase AI Logic SDK
in an Android app using Kotlin DSL (`build.gradle.kts`) and Kotlin code, and
wiring up App Check. First, ensure you have initialized the Firebase App (see
the `firebase-basics` skill and its `references/android_setup.md`). Once the SDK
is initialized, use the capability guides listed in `SKILL.md` (text generation,
chat, streaming, multimodal input, structured output, and so on) for usage
patterns.

## 1. Enable Firebase AI Logic via CLI

Before adding dependencies in your app, make sure you enable the AI Logic
service in your Firebase Project using the Firebase CLI:

```bash
npx -y firebase-tools@latest init ailogic
```

______________________________________________________________________

## 2. Add Dependencies

In your module-level `build.gradle.kts` (usually `app/build.gradle.kts`), add
the dependency for Firebase AI:

```kotlin
dependencies {
    // [AGENT] Fetch the latest available BoM version from https://firebase.google.com/support/release-notes/android before adding this
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

    // Add the dependency for the Firebase AI library
    implementation("com.google.firebase:firebase-ai")
}
```

> [!NOTE] **Renamed SDK.** Firebase AI Logic was formerly "Vertex AI in
> Firebase". The current library is `com.google.firebase:firebase-ai` with the
> `Firebase.ai(backend = GenerativeBackend.googleAI())` entry point. If the app
> still depends on `com.google.firebase:firebase-vertexai` or calls
> `Firebase.vertexAI`, migrate it; do not generate new code against the old
> library. See the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

______________________________________________________________________

## 3. Initialize and Generate Content

In your Activity or Fragment, initialize the `FirebaseAI` service and verify the
setup by generating content with a Gemini model:

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize with replay protection using limited-use App Check tokens:
        val ai = Firebase.ai(
            backend = GenerativeBackend.googleAI(),
            useLimitedUseAppCheckTokens = true
        )

        // [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
        val model = ai.generativeModel("<latest_supported_model>")

        // Generate content
        lifecycleScope.launch {
            try {
                val response = model.generateContent("Write a story about a magic backpack.")
                Log.d(TAG, "Response: ${response.text}")
            } catch (e: Exception) {
                Log.e(TAG, "Error generating content", e)
            }
        }
    }
}
```

`GenerativeBackend.googleAI()` selects the Gemini Developer API (the default).
For the Agent Platform Gemini API use `GenerativeBackend.agentPlatform()`
(optionally `agentPlatform(location = "global")`);
`GenerativeBackend.enterprise()` is the newer name for the same backend, so use
it if `agentPlatform()` shows a deprecation warning.

### Jetpack Compose (Modern)

Initialize inside a `ComponentActivity` and use `setContent`:

```kotlin
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.lifecycle.lifecycleScope
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val ai = Firebase.ai
        // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
        val model = ai.generativeModel("<latest_supported_model>")
        
        lifecycleScope.launch {
            val response = model.generateContent("Hello Gemini!")
            setContent {
                MaterialTheme {
                    Text("AI Response: ${response.text}")
                }
            }
        }
    }
}
```

______________________________________________________________________

## 4. App Check

### Production Provider (Play Integrity)

Add the App Check artifacts next to `firebase-ai` in `app/build.gradle.kts`
(`firebase-ai` only pulls in the core App Check library):

```kotlin
dependencies {
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation("com.google.firebase:firebase-appcheck-debug") // debug provider for emulators
    androidTestImplementation("com.google.firebase:firebase-appcheck-debug-testing")
}
```

Install the Play Integrity provider once, in `Application.onCreate()`, before
any AI Logic call:

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

Firebase.appCheck.installAppCheckProviderFactory(
    PlayIntegrityAppCheckProviderFactory.getInstance()
)
```

### Replay Protection on Android

Generative and preview models enforce replay protection using short-lived
(5-minute) limited-use App Check tokens to prevent replay attacks. If you call a
model enforcing replay protection without limited-use tokens, the request is
rejected with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

To resolve this on Android, pass `useLimitedUseAppCheckTokens = true` when
calling `Firebase.ai`:

```kotlin
val ai = Firebase.ai(
    backend = GenerativeBackend.googleAI(),
    useLimitedUseAppCheckTokens = true
)
```

This ensures the SDK requests fresh limited-use tokens (via Play Integrity or
the debug provider) for each request instead of reusing cached tokens.

### Debug Provider and Debug Tokens

Play Integrity rejects emulators, so debug builds install the debug provider
instead:

```kotlin
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

if (BuildConfig.DEBUG) {
    Firebase.appCheck.installAppCheckProviderFactory(
        DebugAppCheckProviderFactory.getInstance()
    )
}
```

On a normal app run the debug provider generates its own token, stores it in the
app's `SharedPreferences`, and prints it to Logcat as
`Firebase App Check debug token: <uuid>`. Register that token in the Firebase
console under **Security > App Check > Apps > Manage debug tokens**. It survives
app restarts but not a data wipe, emulator reset, or fresh install; after those,
register the newly printed token. The Android SDK has no supported way to inject
a fixed token into a normal run (it does not read a manifest placeholder or
`<meta-data>`).

Instrumentation tests and CI *can* use a pre-provisioned token through
`firebase-appcheck-debug-testing`, without hardcoding it:

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Never hardcode
> debug token strings in `build.gradle.kts` or Kotlin source files. Store the
> token in gitignored `local.properties` (or a CI secret) and inject it
> dynamically.

1. In gitignored `local.properties` (or the `APP_CHECK_DEBUG_TOKEN` CI secret):

   ```properties
   APP_CHECK_DEBUG_TOKEN=<YOUR_DEBUG_TOKEN>
   ```

1. In `app/build.gradle.kts`, pass it as an instrumentation argument:

   ```kotlin
   val localProperties = java.util.Properties().apply {
       val localPropertiesFile = rootProject.file("local.properties")
       if (localPropertiesFile.exists()) {
           load(localPropertiesFile.inputStream())
       }
   }
   val appCheckDebugToken = localProperties.getProperty("APP_CHECK_DEBUG_TOKEN")
       ?: System.getenv("APP_CHECK_DEBUG_TOKEN") ?: ""

   android {
       defaultConfig {
           // Instrumentation tests only (read by firebase-appcheck-debug-testing).
           // Normal runs: the debug provider generates and logs its own token; no manifest placeholder exists.
           if (appCheckDebugToken.isNotEmpty()) {
               testInstrumentationRunnerArguments["firebaseAppCheckDebugSecret"] = appCheckDebugToken
           }
       }
   }
   ```

1. In the instrumentation test, run the code under test inside
   `withDebugProvider`, which installs the debug provider with that token:

   ```kotlin
   import com.google.firebase.appcheck.debug.testing.DebugAppCheckTestHelper

   private val debugAppCheckTestHelper = DebugAppCheckTestHelper.fromInstrumentationArgs()

   @Test
   fun generatesContent() {
       debugAppCheckTestHelper.withDebugProvider<Exception> {
           // Test code that calls AI Logic with a valid debug App Check token
       }
   }
   ```

______________________________________________________________________

## 5. Multimodal Input (Text and Images)

Pass bitmap data along with text prompts:

```kotlin
val image1: Bitmap = ... // Load your bitmap
val image2: Bitmap = ...

val response = model.generateContent(
    content {
        image(image1)
        image(image2)
        text("Analyze these images for me. Compare these two items.")
    }
)
Log.d(TAG, response.text)
```

______________________________________________________________________

## 6. Chat Session (Multi-turn)

Maintain chat history automatically:

```kotlin
val chat = model.startChat(
    history = listOf(
        content("user") { text("Hello, I am a software engineer.") },
        content("model") { text("Hello! How can I help you today?") }
    )
)

lifecycleScope.launch {
    val response = chat.sendMessage("What should I learn next?")
    Log.d(TAG, response.text)
}
```

______________________________________________________________________

## 7. Streaming Responses

For faster display, stream the response:

```kotlin
lifecycleScope.launch {
    model.generateContentStream("Tell me a long story.")
        .collect { chunk ->
            print(chunk.text) // Update UI incrementally
        }
}
```

______________________________________________________________________

## Next Steps

The SDK is now ready. Pick the capability guide that matches the feature you are
building from the **SDK Usage** table in `SKILL.md`; every guide has an Android
(Kotlin) section that builds on the `ai` and `model` instances created above.

Last verified against
https://firebase.google.com/docs/ai-logic/get-started.md.txt,
https://firebase.google.com/docs/ai-logic/app-check.md.txt, and the Firebase SDK
sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk, flutterfire;
`main` branches) on 2026-10-08.
