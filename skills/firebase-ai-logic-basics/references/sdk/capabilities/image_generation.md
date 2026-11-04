# Image Generation (Nano Banana)

See the
[Generate and edit images using Gemini](https://firebase.google.com/docs/ai-logic/generate-images-gemini.md.txt)
guide for full details.

Gemini Nano Banana (image-generation) models generate and edit images directly
from the client. Use this capability when an app needs to create a picture from
a text prompt, render text inside an image, produce interleaved text-and-image
output (for example an illustrated recipe), edit a user-supplied image, or
refine an image over several chat turns. Image generation works only with
dedicated Gemini Nano Banana models (never the general-purpose text models), and
requires the Firebase project to be on the pay-as-you-go Blaze pricing plan
regardless of the Gemini API provider.

## Configuration

> [!WARNING] **Blaze plan required.** Image generation requires the Firebase
> project to be on the pay-as-you-go Blaze pricing plan regardless of your
> Gemini API provider. Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported Gemini Nano Banana model names.

- **Model**: Use a dedicated Gemini Nano Banana model. General-use Gemini models
  do not generate images. Do NOT use Imagen models. They are shut down.
  [Migrate any Imagen code to use Gemini Nano Banana models.](https://firebase.google.com/docs/ai-logic/imagen-models-migration.md.txt)
  Every snippet below uses the placeholder `<latest_supported_image_model>`;
  replace it with an applicable Gemini Nano Banana model from the models page.
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
- **Output size**: Set `imageConfig` inside `generationConfig` to choose an
  aspect ratio and image size. See
  [Configure image generation](https://firebase.google.com/docs/ai-logic/generate-images-gemini#configure-image-generation)
  for supported options and SDK syntax.
- **Input**: All Gemini Nano Banana models accept image input (for editing, and
  as reference images for objects, characters, or style). See
  [Use reference images](https://firebase.google.com/docs/ai-logic/generate-images-gemini#reference-images)
  for supported input options and limits.
- **Editing and iteration**: Pass the source image together with the text
  prompt. For iterative edits, use a chat session (`startChat()` /
  `sendMessage()`) with the same model configuration; follow-up turns do not
  need to resend the image.
- **Images are not guaranteed**: The model may answer with text only
  (`FinishReason` `NO_IMAGE`), especially for ambiguous prompts, or refuse an
  unsafe prompt (`FinishReason` `STOP`). On Android (`ResponseStoppedException`
  from `generateContent`), iOS (`GenerateContentError.responseStoppedEarly`) and
  Web (`AIError` from `inlineDataParts()`), `NO_IMAGE` throws an error; Flutter
  returns empty `inlineDataParts`. Ask for images explicitly ("generate an
  image", "update the image") and handle the no-image case in the UI.
- Grounding with Google Search and structured output are supported on some
  Gemini Nano Banana models; check the
  [official image generation guide](https://firebase.google.com/docs/ai-logic/generate-images-gemini.md.txt)
  for feature support.

## Android (Kotlin)

### Generate an image from text

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
// [AGENT] Replace "<latest_supported_image_model>" with the latest Nano Banana model from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
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
same image-generation-capable `model`:

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

### Generate an image from text

Create the model with the `.image` response modality and read the first
`InlineDataPart` from the response. Replace the `fatalError` calls with real
error handling in production code:

```swift
import FirebaseAILogic
import UIKit

// Create a `GenerativeModel` instance with a Gemini model that supports image output.
// [AGENT] Replace "<latest_supported_image_model>" with the latest Nano Banana model from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
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

Pass a `UIImage` together with the text prompt to the same
image-generation-capable `model`:

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

### Generate an image from text

Create the model with `ResponseModalities.image` and read the bytes from
`response.inlineDataParts` (for example to show them with `Image.memory`):

```dart
import 'package:firebase_ai/firebase_ai.dart';

// Create a `GenerativeModel` instance with a Gemini model that supports image output.
// [AGENT] Replace '<latest_supported_image_model>' with the latest Nano Banana model from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
final model = FirebaseAI.googleAI().generativeModel(
  model: '<latest_supported_image_model>',
  generationConfig: GenerationConfig(
    // Configure the model to respond with images only.
    responseModalities: [ResponseModalities.image],
    // Specify aspect ratio and image size (both optional) in an image config.
    // For supported values, see
    // https://firebase.google.com/docs/ai-logic/generate-images-gemini#configure-image-generation
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
with a `TextPart` in a single `Content.multi` to the same
image-generation-capable `model`:

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

### Generate an image from text

`ai` is the AI Logic service instance created during setup with
`getAI(app, { backend: new GoogleAIBackend() })`. This sample requests both
`TEXT` and `IMAGE`, so the model may return text parts alongside the image;
`inlineDataParts()` returns only the image parts. Drop `ResponseModality.TEXT`
for image-only output. To display the result, build a data URL from the part:
`` `data:${image.mimeType};base64,${image.data}` ``.

```javascript
import { getGenerativeModel, ResponseModality } from "firebase/ai";

// Create a `GenerativeModel` instance with a Gemini model that supports image output.
// [AGENT] Replace "<latest_supported_image_model>" with the latest Nano Banana model from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
const model = getGenerativeModel(ai, {
  model: "<latest_supported_image_model>",
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
the same image-generation-capable `model`:

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

## Troubleshooting

- **Response contains text but no image, or throws `NO_IMAGE`** (`FinishReason`
  is `NO_IMAGE`; throws `ResponseStoppedException` on Android,
  `GenerateContentError.responseStoppedEarly` on iOS, and `AIError` from
  `inlineDataParts()` on Web; Flutter returns empty `inlineDataParts`): the
  prompt was ambiguous. Ask for image output explicitly ("generate an image",
  "provide images as you go along", "update the image") or retry.
- **Model refuses and returns only text** (`FinishReason` is `STOP`): the prompt
  was judged potentially unsafe; the model will not create the image.
- **No image parts and the model is a general-use Gemini model**: image
  generation is only supported by Gemini Nano Banana (image-generation) models.
  Pick an image model from the models page.
- **Billing or permission errors**: the Firebase project must be on the
  pay-as-you-go Blaze pricing plan for image generation, even with the Gemini
  Developer API.
- **`imageConfig` rejected or fails to compile**: Android (`AspectRatio`,
  `ImageSize`), iOS (`ImageConfig.AspectRatio`, `ImageConfig.ImageSize`), and
  Flutter (`ImageAspectRatio`, `ImageSize`) use strongly-typed constants rather
  than raw strings; on Web, use `ImageConfigAspectRatio` /
  `ImageConfigImageSize` or valid string literals (see
  [Configure image generation](https://firebase.google.com/docs/ai-logic/generate-images-gemini#configure-image-generation)).
- **HTTP 413 when editing**: inline request data exceeded the request size
  limit; resize or compress the input image before sending it.
- **Generated text appears inside the image instead of as text**: ask for text
  output explicitly ("generate narrative text along with illustrations"). When
  an image must contain text, generate the text first, then the image.
