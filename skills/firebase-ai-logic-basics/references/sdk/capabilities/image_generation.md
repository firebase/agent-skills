# Image Generation (Nano Banana)

## Android (Kotlin)

Create the model with `ResponseModality.IMAGE`, call `generateContent` from a
coroutine (for example `lifecycleScope.launch`), and pick the `ImagePart` out of
the first candidate:

```kotlin
import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.ImagePart
import com.google.firebase.ai.type.ResponseModality
import com.google.firebase.ai.type.generationConfig

// Create a `GenerativeModel` instance with a Gemini model that supports image output.
// [AGENT] Replace "<latest_supported_image_model>" with the latest image model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_image_model>",
    // Configure the model to respond with images only.
    generationConfig = generationConfig {
        responseModalities = listOf(ResponseModality.IMAGE)
    }
)

// Provide a text prompt instructing the model to generate an image
val prompt = "Generate an image of the Eiffel tower with fireworks in the background."

// To generate image output, call `generateContent` with the text input
val generatedImageAsBitmap: Bitmap? = model.generateContent(prompt)
    // Handle the generated image
    .candidates.firstOrNull()?.content?.parts?.filterIsInstance<ImagePart>()?.firstOrNull()?.image
```

### Edit an image

Send the source bitmap and the instruction in one `content { }` block, using the
same image-capable `model`:

```kotlin
import android.graphics.BitmapFactory
import com.google.firebase.ai.type.content

// Provide an image for the model to edit
val bitmap = BitmapFactory.decodeResource(context.resources, R.drawable.scones)

// Provide a text prompt instructing the model to edit the image
val prompt = content {
    image(bitmap)
    text("Edit this image to make it look like a cartoon")
}

// To edit the image, call `generateContent` with the prompt (image and text input)
val generatedImageAsBitmap = model.generateContent(prompt)
    // Handle the generated image
    .candidates.firstOrNull()?.content?.parts?.filterIsInstance<ImagePart>()?.firstOrNull()?.image
```
