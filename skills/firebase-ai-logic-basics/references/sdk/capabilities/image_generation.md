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

## iOS (Swift)

Create the model with the `.image` response modality and read the first
`InlineDataPart` from the response. Replace the `fatalError` calls with real
error handling in production code:

```swift
import FirebaseAILogic
import UIKit

// Create a `GenerativeModel` instance with a Gemini model that supports image output.
// [AGENT] Replace "<latest_supported_image_model>" with the latest image model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_image_model>",
  // Configure the model to respond with images only.
  generationConfig: GenerationConfig(responseModalities: [.image])
)

// Provide a text prompt instructing the model to generate an image
let prompt = "Generate an image of the Eiffel tower with fireworks in the background."

// To generate an image, call `generateContent` with the text input
let response = try await model.generateContent(prompt)

// Handle the generated image
guard let inlineDataPart = response.inlineDataParts.first else {
  fatalError("No image data in response.")
}
guard let uiImage = UIImage(data: inlineDataPart.data) else {
  fatalError("Failed to convert data to UIImage.")
}
```

### Edit an image

Pass a `UIImage` together with the text prompt to the same image-capable
`model`:

```swift
// Provide an image for the model to edit
guard let image = UIImage(named: "scones") else { fatalError("Image file not found.") }

// Provide a text prompt instructing the model to edit the image
let prompt = "Edit this image to make it look like a cartoon"

// To edit the image, call `generateContent` with the image and text input
let response = try await model.generateContent(image, prompt)

// Handle the generated image
guard let inlineDataPart = response.inlineDataParts.first else {
  fatalError("No image data in response.")
}
guard let uiImage = UIImage(data: inlineDataPart.data) else {
  fatalError("Failed to convert data to UIImage.")
}
```

## Flutter (Dart)

Create the model with `ResponseModalities.image` and read the bytes from
`response.inlineDataParts` (for example to show them with `Image.memory`):

```dart
import 'package:firebase_ai/firebase_ai.dart';

// Create a `GenerativeModel` instance with a Gemini model that supports image output.
// [AGENT] Replace '<latest_supported_image_model>' with the latest image model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(
  model: '<latest_supported_image_model>',
  generationConfig: GenerationConfig(
    // Configure the model to respond with images only.
    responseModalities: [ResponseModalities.image],
    // Specify aspect ratio and image size (both optional) in an image config.
    // The default is a square (1:1) image at 1024x1024.
    imageConfig: ImageConfig(
      aspectRatio: ImageAspectRatio.landscape16x9,
      imageSize: ImageSize.size2K,
    ),
  ),
);

// Provide a text prompt instructing the model to generate an image
final prompt = [Content.text('Generate an image of the Eiffel Tower with fireworks in the background.')];

// To generate an image, call `generateContent` with the text input
final response = await model.generateContent(prompt);
if (response.inlineDataParts.isNotEmpty) {
  final imageBytes = response.inlineDataParts.first.bytes;
  // Process the image
} else {
  // Handle the case where no images were generated
  print('Error: No images were generated.');
}
```

### Edit an image

Wrap the image bytes in an `InlineDataPart` with their MIME type and send them
with a `TextPart` in a single `Content.multi` to the same image-capable `model`:

```dart
import 'dart:io';
import 'package:firebase_ai/firebase_ai.dart';

// Prepare an image for the model to edit
final image = await File('scones.jpg').readAsBytes();
final imagePart = InlineDataPart('image/jpeg', image);

// Provide a text prompt instructing the model to edit the image
final prompt = TextPart('Edit this image to make it look like a cartoon');

// To edit the image, call `generateContent` with the image and text input
final response = await model.generateContent([
  Content.multi([imagePart, prompt]),
]);

// Handle the generated image
if (response.inlineDataParts.isNotEmpty) {
  final imageBytes = response.inlineDataParts.first.bytes;
  // Process the image
} else {
  // Handle the case where no images were generated
  print('Error: No images were generated.');
}
```

## Web (JavaScript)

`ai` is the AI Logic service instance created during setup with
`getAI(app, { backend: new GoogleAIBackend() })`. This sample requests both
`TEXT` and `IMAGE`, so the model may return text parts alongside the image;
`inlineDataParts()` returns only the image parts. Drop `ResponseModality.TEXT`
for image-only output. To display the result, build a data URL from the part:
`` `data:${image.mimeType};base64,${image.data}` ``.

```javascript
import { getGenerativeModel, ResponseModality } from "firebase/ai";

// Create a `GenerativeModel` instance with a model that supports your use case
const model = getGenerativeModel(ai, {
  model: "<latest_supported_image_model>", // [AGENT] Replace with the latest image model from https://firebase.google.com/docs/ai-logic/models.md.txt
  // Configure the model to respond with text and images (required)
  generationConfig: {
    responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE],
  },
});

// Provide a text prompt instructing the model to generate an image
const prompt = 'Generate an image of the Eiffel Tower with fireworks in the background.';

// To generate an image, call `generateContent` with the text input
const result = await model.generateContent(prompt);

// Handle the generated image
try {
  const inlineDataParts = result.response.inlineDataParts();
  if (inlineDataParts?.[0]) {
    const image = inlineDataParts[0].inlineData;
    console.log(image.mimeType, image.data);
  }
} catch (err) {
  console.error('Prompt or candidate was blocked:', err);
}
```

### Edit an image

Convert the user's file to an inline data part and pass it with the prompt to
the same image-capable `model`:

```javascript
// Prepare an image for the model to edit
async function fileToGenerativePart(file) {
  const base64EncodedDataPromise = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    type: "inlineData",
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

// Provide a text prompt instructing the model to edit the image
const prompt = "Edit this image to make it look like a cartoon";

const fileInputEl = document.querySelector("input[type=file]");
const imagePart = await fileToGenerativePart(fileInputEl.files[0]);

// To edit the image, call `generateContent` with the image and text input
const result = await model.generateContent([imagePart, prompt]);

// Handle the generated image
try {
  const inlineDataParts = result.response.inlineDataParts();
  if (inlineDataParts?.[0]) {
    const image = inlineDataParts[0].inlineData;
    console.log(image.mimeType, image.data);
  }
} catch (err) {
  console.error('Prompt or candidate was blocked:', err);
}
```
