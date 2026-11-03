# Text Generation

## Android (Kotlin)

Call `generativeModel` and use the suspend function `generateContent` from a
coroutine scope (such as `lifecycleScope`):

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend

// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>"
)

// Generate content
lifecycleScope.launch {
    try {
        val response = model.generateContent("Write a story about a magic backpack.")
        Log.d(TAG, "Response: ${response.text}")
    } catch (e: Exception) {
        Log.e(TAG, "Error generating content", e)
    }
}
```
