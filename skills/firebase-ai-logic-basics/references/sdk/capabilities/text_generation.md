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

## iOS (Swift)

Call `generativeModel(modelName:)` and `await generateContent(prompt)`.
`response.text` is optional, so always provide a fallback. In SwiftUI, run the
call from a `Task` inside an `@Observable` view model (see the iOS setup guide
for that pattern).

```swift
import FirebaseAILogic

let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>" // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
)

// Provide a prompt that contains text
let prompt = "Write a story about a magic backpack."
// To generate text output, call generateContent with the text input
do {
  let response = try await model.generateContent(prompt)
  print(response.text ?? "No response")
} catch {
  print("Error generating content: \(error.localizedDescription)")
}
```

### Optional: Custom Generation Config & Safety Settings

Create an optional `GenerationConfig` struct and an array of `SafetySetting`s,
and pass both to `generativeModel(modelName:generationConfig:safetySettings:)`:

```swift
import FirebaseAILogic

// Set optional parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
let config = GenerationConfig(
  maxOutputTokens: 200,
  stopSequences: ["red"]
)

// You can configure safety thresholds to prevent the model from generating harmful content.
let safetySettings = [
  SafetySetting(harmCategory: .harassment, threshold: .blockLowAndAbove),
  SafetySetting(harmCategory: .hateSpeech, threshold: .blockMediumAndAbove)
]

let configuredModel = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>",
  generationConfig: config,
  safetySettings: safetySettings
)
```
