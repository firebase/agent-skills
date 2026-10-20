# Multimodal Input

## Android (Kotlin)

Pass bitmap data along with text prompts. `image()` takes a `Bitmap` directly,
so no MIME type is needed:

```kotlin
import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.content

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel("<latest_supported_model>")

val image1: Bitmap = ... // Load your bitmap
val image2: Bitmap = ...

val response = model.generateContent(
    content {
        image(image1)
        image(image2)
        text("Analyze these images for me. Compare these two items.")
    }
)
Log.d(TAG, response.text ?: "")
```

For any other media type (or for full control over image encoding), pass the raw
bytes with `inlineData(bytes, mimeType)` instead of `image()`. The MIME type is
the only thing that changes between a PDF, an audio clip, or a video:

```kotlin
// pdfUri is a content:// Uri, e.g. from the system file picker
val bytes = applicationContext.contentResolver.openInputStream(pdfUri)!!.use { it.readBytes() }
val response = model.generateContent(
    content {
        inlineData(bytes, "application/pdf") // or "audio/mpeg", "video/mp4", "image/png"
        text("Summarize the important results in this report.")
    }
)
Log.d(TAG, response.text ?: "")
```

Cloud Storage for Firebase URL (Agent Platform Gemini API provider only): use
`fileData(uri = "gs://bucket-name/path/image.jpg", mimeType = "image/jpeg")` in
place of `inlineData(...)` inside the same `content { }` block.
