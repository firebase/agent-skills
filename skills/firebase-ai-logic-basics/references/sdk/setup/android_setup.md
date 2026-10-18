# Firebase AI Logic on Android (Kotlin)

First, ensure you have initialized the Firebase App (see `firebase-basics`
skill). Then, initialize the AI Logic service as below

### 0. Enable Firebase AI Logic via CLI

Before adding dependencies in your app, make sure you enable the AI Logic
service in your Firebase Project using the Firebase CLI:

```bash
npx -y firebase-tools@latest init ailogic
```

______________________________________________________________________

### 1. Add Dependencies

In your module-level `build.gradle.kts` (usually `app/build.gradle.kts`, with
`minSdk = 24` or higher required by `firebase-ai:18.0.0+`), add the dependency
for Firebase AI:

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
> `Firebase.vertexAI` / `GenerativeBackend.vertexAI()`, migrate it; do not
> generate new code against the old library. See the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

______________________________________________________________________

### 2. Initialize and Generate Content

In your Activity or Fragment, initialize the `FirebaseAI` service and generate
content using a Gemini model:

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
(optionally `GenerativeBackend.agentPlatform(location = "global")`; `"global"`
is the default location, and `GenerativeBackend.vertexAI()` was removed in
`firebase-ai:18.0.0`).

#### App Check Enforcement and Replay Protection on Android

Firebase AI Logic requires Firebase App Check for commonly abused models. If App
Check is not configured in your app and enforced in the Firebase console,
requests to those models are rejected with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

In addition, when **replay protection** is enabled in App Check, pass
`useLimitedUseAppCheckTokens = true` when calling `Firebase.ai`:

```kotlin
val ai = Firebase.ai(
    backend = GenerativeBackend.googleAI(),
    useLimitedUseAppCheckTokens = true
)
```

This ensures the SDK requests fresh single-use (5-minute TTL) App Check tokens
(via Play Integrity or the debug provider) for each request instead of reusing
cached tokens.

#### Jetpack Compose (Modern)

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
import com.google.firebase.ai.type.GenerativeBackend
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val ai = Firebase.ai(
            backend = GenerativeBackend.googleAI(),
            useLimitedUseAppCheckTokens = true
        )
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

### 3. App Check Debug Provider

For App Check debug tokens during local development and CI/CD, add the App Check
dependencies in `app/build.gradle.kts` (`firebase-appcheck-playintegrity`,
`firebase-appcheck-debug`, and `androidTestImplementation` for
`firebase-appcheck-debug-testing`), then install
`DebugAppCheckProviderFactory.getInstance()` as the App Check provider factory
in debug builds (and `PlayIntegrityAppCheckProviderFactory.getInstance()` in
release builds):

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

if (BuildConfig.DEBUG) {
    Firebase.appCheck.installAppCheckProviderFactory(
        DebugAppCheckProviderFactory.getInstance()
    )
} else {
    Firebase.appCheck.installAppCheckProviderFactory(
        PlayIntegrityAppCheckProviderFactory.getInstance()
    )
}
```

#### Debug Token Persistence

Emulator resets or clearing app storage erase `SharedPreferences`, causing
`DebugAppCheckProviderFactory` to print a new debug token in Logcat (on normal
emulator runs, the Android SDK generates and logs its own token in
`SharedPreferences` and does not read a manifest placeholder). To persist a
stable debug token in instrumentation tests and CI across emulator resets and
fresh installs without hardcoding secrets:

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Never hardcode
> debug token strings in `build.gradle.kts` or Kotlin source files. Store the
> token in gitignored `local.properties` and inject it dynamically.

1. In gitignored `local.properties`:

   ```properties
   APP_CHECK_DEBUG_TOKEN=<YOUR_DEBUG_TOKEN>
   ```

1. In `app/build.gradle.kts`:

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
           // For instrumentation tests (read by firebase-appcheck-debug-testing)
           if (appCheckDebugToken.isNotEmpty()) {
               testInstrumentationRunnerArguments["firebaseAppCheckDebugSecret"] = appCheckDebugToken
           }
       }
   }
   ```

1. In your instrumentation test, wrap calls in `DebugAppCheckTestHelper` (and
   `runTest` from `kotlinx-coroutines-test` since AI Logic APIs are `suspend`
   functions):

   ```kotlin
   import com.google.firebase.appcheck.debug.testing.DebugAppCheckTestHelper
   import kotlinx.coroutines.test.runTest

   private val debugAppCheckTestHelper = DebugAppCheckTestHelper.fromInstrumentationArgs()

   @Test
   fun generatesContent() {
       debugAppCheckTestHelper.withDebugProvider<Exception> {
           runTest {
               // Test suspend AI Logic calls with the pre-provisioned debug token
           }
       }
   }
   ```
