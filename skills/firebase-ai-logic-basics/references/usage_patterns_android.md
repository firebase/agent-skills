# Firebase AI Logic on Android (Kotlin)

This guide walks you through using Firebase AI Logic (accessing Gemini models) in your Android app using Kotlin.

### 1. Add Dependencies

In your module-level `build.gradle.kts` (usually `app/build.gradle.kts`), add the dependency for Firebase AI:

```kotlin
dependencies {
    // Import the BoM (verify latest version)
    implementation(platform("com.google.firebase:firebase-bom:33.0.0"))

    // Add the dependency for the Firebase AI library
    implementation("com.google.firebase:firebase-ai")
}
```

---

### 2. Initialize and Generate Content

In your Activity or Fragment, initialize the `FirebaseAI` service and generate content using a Gemini model:

```kotlin
import com.google.firebase.ai.FirebaseAI
import com.google.firebase.ai.ktx.ai
import com.google.firebase.ktx.Firebase

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize Firebase AI
        val ai = Firebase.ai

        // Use a model (e.g., gemini-2.5-flash-lite)
        val model = ai.generativeModel("gemini-2.5-flash-lite")

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

---

### 3. Multimodal Input (Text and Images)

Pass bitmap data along with text prompts:

```kotlin
val image1: Bitmap = ... // Load your bitmap
val image2: Bitmap = ...

val response = model.generateContent(
    content("Analyze these images for me") {
        image(image1)
        image(image2)
        text("Compare these two items.")
    }
)
Log.d(TAG, response.text)
```

---

### 4. Chat Session (Multi-turn)

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

---

### 5. Streaming Responses

For faster display, stream the response:

```kotlin
lifecycleScope.launch {
    model.generateContentStream("Tell me a long story.")
        .collect { chunk ->
            print(chunk.text) // Update UI incrementally
        }
}
```
