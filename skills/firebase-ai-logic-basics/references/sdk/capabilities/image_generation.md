# Image Generation (Nano Banana)

Gemini Image models ("Nano Banana") generate and edit images directly from the
client. Use this capability when an app needs to create a picture from a text
prompt, render text inside an image, produce interleaved text-and-image output
(for example an illustrated recipe), edit a user-supplied image, or refine an
image over several chat turns. Image generation is a Preview feature, works only
with dedicated Gemini Image models (never the general-purpose text models), and
requires the Blaze pay-as-you-go billing plan regardless of the Gemini API
provider.

## Configuration

> [!WARNING] **Blaze plan required.** Image generation requires an upgraded
> Blaze pay-as-you-go billing plan regardless of your Gemini API provider.
> Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported image generation (Nano Banana) model names.

- **Model**: Use a dedicated Gemini Image model. General-use Gemini models do
  not generate images. Every snippet below uses the placeholder
  `<latest_supported_image_model>`; replace it with the current image model from
  the models page.
- **Response modality (required)**: The model must be configured with
  `responseModalities` in `generationConfig` that include `IMAGE`. Add `TEXT`
  only when you want interleaved text and images in the same response (the model
  then returns text parts and image parts in order); for image-only output
  request `IMAGE` alone.
- **Reading the result**: Generated images come back as inline data parts (PNG).
  Kotlin exposes them as `ImagePart` (a `Bitmap`) in
  `candidates.first().content.parts`; Swift as `response.inlineDataParts`
  (`Data`); Dart as `response.inlineDataParts` (`bytes`); Web as
  `result.response.inlineDataParts()` (base64 `data` plus `mimeType`).
- **Output size**: By default images are square (1:1) at 1024x1024. Set
  `imageConfig` inside `generationConfig` to choose an aspect ratio and image
  size (supported sizes depend on the model):
  - **Android**:
    `imageConfig = imageConfig { aspectRatio = AspectRatio.LANDSCAPE_16x9; imageSize = ImageSize.SIZE_2K }`
  - **iOS**:
    `imageConfig: ImageConfig(aspectRatio: .landscape16x9, imageSize: .size2K)`
  - **Flutter**:
    `imageConfig: ImageConfig(aspectRatio: ImageAspectRatio.landscape16x9, imageSize: ImageSize.size2K)`
  - **Web**: `imageConfig: { aspectRatio: "16:9", imageSize: "2K" }` (strings:
    `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`,
    `9:16`, `16:9`, `21:9`; sizes: `512`, `1K`, `2K`, `4K` with uppercase `K`).
- **Input**: All Gemini Image models accept image input (for editing, and as
  reference images for objects, characters, or style; per-model limits are in
  the official guide); some accept video input; none accept audio. Inline
  request data is limited to 20 MB.
- **Editing and iteration**: Pass the source image together with the text
  prompt. For iterative edits, use a chat session (`startChat()` /
  `sendMessage()`) with the same model configuration; follow-up turns do not
  need to resend the image.
- **Images are not guaranteed**: The model may answer with text only
  (`FinishReason` `NO_IMAGE`), especially for ambiguous prompts, or refuse an
  unsafe prompt (`FinishReason` `STOP`). On iOS
  (`GenerateContentError.responseStoppedEarly`) and Web (`AIError` from
  `inlineDataParts()`), `NO_IMAGE` throws an error rather than returning empty
  image parts. Ask for images explicitly ("generate an image", "update the
  image") and handle the no-image case in the UI.
- Grounding with Google Search and structured output are supported on some image
  models only; check the official guide for the current model matrix.

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
    .candidates.first().content.parts.filterIsInstance<ImagePart>().firstOrNull()?.image
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
    .candidates.first().content.parts.filterIsInstance<ImagePart>().firstOrNull()?.image
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
  // Configure the model to respond with images only.
  generationConfig: GenerationConfig(responseModalities: [ResponseModalities.image]),
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
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
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

## Troubleshooting

- **Response contains text but no image, or throws `NO_IMAGE`** (`FinishReason`
  is `NO_IMAGE`; throws `GenerateContentError.responseStoppedEarly` on iOS and
  `AIError` from `inlineDataParts()` on Web): the prompt was ambiguous. Ask for
  image output explicitly ("generate an image", "provide images as you go
  along", "update the image") or retry.
- **Model refuses and returns only text** (`FinishReason` is `STOP`): the prompt
  was judged potentially unsafe; the model will not create the image.
- **No image parts and the model is a general-use Gemini model**: image
  generation is only supported by Gemini Image models. Pick an image model from
  the models page.
- **Billing or permission errors**: the project must be on the Blaze plan for
  image generation, even with the Gemini Developer API.
- **`imageConfig` rejected or fails to compile**: Android (`AspectRatio`,
  `ImageSize`), iOS (`ImageConfig.AspectRatio`, `ImageConfig.ImageSize`), and
  Flutter (`ImageAspectRatio`, `ImageSize`) use strongly-typed constants rather
  than raw strings; on Web, use string literals with an uppercase `K` suffix
  (`1K`, `2K`, `4K`; `512` has no suffix).
- **HTTP 413 when editing**: inline request data is limited to 20 MB; resize or
  compress the input image before sending it.
- **Generated text appears inside the image instead of as text**: ask for text
  output explicitly ("generate narrative text along with illustrations"). When
  an image must contain text, generate the text first, then the image.

See the official image generation guide:
https://firebase.google.com/docs/ai-logic/generate-images-gemini

Last verified against
https://firebase.google.com/docs/ai-logic/generate-images-gemini.md.txt and the
Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk,
flutterfire; `main` branches) on 2026-10-09.
