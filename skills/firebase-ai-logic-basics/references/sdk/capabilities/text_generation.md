# Text Generation

## Android (Kotlin)

Call `generativeModel` and use the suspend function `generateContent` from a
coroutine scope (such as `lifecycleScope`):

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
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

### Optional: Custom Generation Config & Safety Settings

Build an optional config with the `generationConfig { }` DSL and pass it
together with a list of `SafetySetting`s to `generativeModel`. The
`SafetySetting` constructor takes the category and threshold positionally.

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.HarmBlockThreshold
import com.google.firebase.ai.type.HarmCategory
import com.google.firebase.ai.type.SafetySetting
import com.google.firebase.ai.type.generationConfig

// Set optional parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
val config = generationConfig {
    maxOutputTokens = 200
    stopSequences = listOf("red")
}

// Specify the config and safety settings as part of creating the `GenerativeModel` instance.
val configuredModel = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    generationConfig = config,
    safetySettings = listOf(
        SafetySetting(HarmCategory.HARASSMENT, HarmBlockThreshold.ONLY_HIGH),
        SafetySetting(HarmCategory.HATE_SPEECH, HarmBlockThreshold.MEDIUM_AND_ABOVE)
    )
)
```
