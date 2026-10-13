# Grounding with Google Search

## Android (Kotlin)

Pass `Tool.googleSearch()` in `tools`. `generateContent` is a suspend function
and must be called from a coroutine scope. Show `renderedContent` in a
`WebView`.

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.Tool

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    // Provide Google Search as a tool that the model can use to generate its response
    tools = listOf(Tool.googleSearch())
)

val response = model.generateContent("Who won the euro 2024?")

// Get the model's response
val text = response.text

// Get the grounding metadata
val groundingMetadata = response.candidates.firstOrNull()?.groundingMetadata

// REQUIRED - display Google Search suggestions
// (renderedContent contains HTML and CSS for the search widget)
val renderedContent = groundingMetadata?.searchEntryPoint?.renderedContent
if (renderedContent != null) {
    // TODO(developer): Display Google Search suggestions using a WebView
}

// REQUIRED - display sources
groundingMetadata?.groundingChunks?.forEach { chunk ->
    val title = chunk.web?.title  // for example, "uefa.com"
    val uri = chunk.web?.uri  // for example, "https://vertexaisearch.cloud.google.com..."
    // TODO(developer): show source in the UI
}
```

## iOS (Swift)

Pass `.googleSearch()` in `tools` (the docs write `Tool.googleSearch()`; the
implicit-member form compiles whether the SDK exposes `Tool` at top level or as
`GenerativeModel.Tool`). Show `renderedContent` in a `WKWebView`.

```swift
import FirebaseAILogic

let ai = FirebaseAI.firebaseAI(backend: .googleAI())

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = ai.generativeModel(
  modelName: "<latest_supported_model>",
  // Provide Google Search as a tool that the model can use to generate its response.
  tools: [.googleSearch()]
)

let response = try await model.generateContent("Who won the euro 2024?")

// Get the model's response
let text = response.text

// Get the grounding metadata
if let candidate = response.candidates.first,
   let groundingMetadata = candidate.groundingMetadata {
  // REQUIRED - display Google Search suggestions
  // (renderedContent contains HTML and CSS for the search widget)
  if let renderedContent = groundingMetadata.searchEntryPoint?.renderedContent {
    // TODO(developer): Display Google Search suggestions using a WebView
  }

  // REQUIRED - display sources
  for chunk in groundingMetadata.groundingChunks {
    if let web = chunk.web {
      let title = web.title  // for example, "uefa.com"
      let uri = web.uri  // for example, "https://vertexaisearch.cloud.google.com..."
      // TODO(developer): show source in the UI
    }
  }
}
```
