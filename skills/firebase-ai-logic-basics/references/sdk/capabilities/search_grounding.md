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
