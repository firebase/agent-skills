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

## iOS (Swift)

`generateContent` is variadic and accepts `UIImage` (and other platform image
types) directly alongside the prompt string, so no MIME type is needed for
images:

```swift
import FirebaseAILogic
import UIKit

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(modelName: "<latest_supported_model>")

guard let image = UIImage(named: "scones") else { fatalError() }
// Provide a text prompt to include with the image
let prompt = "What's in this picture?"
// To generate text output, call generateContent and pass in the prompt
let response = try await model.generateContent(image, prompt)
print(response.text ?? "No text in response.")
```

For PDFs, audio, video, or images with an explicit encoding, wrap the bytes in
an `InlineDataPart` with the matching MIME type and pass it the same way:

```swift
// Provide the PDF as `Data` with the appropriate MIME type
let pdf = try InlineDataPart(data: Data(contentsOf: pdfURL), mimeType: "application/pdf")
// e.g. audio instead: InlineDataPart(data: audioData, mimeType: "audio/mpeg")
let response = try await model.generateContent(pdf, "Summarize the important results in this report.")
print(response.text ?? "No text in response.")
```

Cloud Storage for Firebase URL (Agent Platform Gemini API provider only): pass
`FileDataPart(uri: "gs://bucket-name/path/image.jpg", mimeType: "image/jpeg")`
in place of the `InlineDataPart`.

## Flutter (Dart)

Build an `InlineDataPart(mimeType, bytes)` and combine it with a `TextPart` in a
single `Content.multi` message:

```dart
import 'dart:io';
import 'package:firebase_ai/firebase_ai.dart';

// [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(model: '<latest_supported_model>');

// Provide a text prompt to include with the image
final prompt = TextPart("What's in the picture?");
// Prepare the image for input (any Uint8List works, e.g. from image_picker)
final image = await File('image0.jpg').readAsBytes();
final imagePart = InlineDataPart('image/jpeg', image);
// To generate text output, call generateContent with the image and text
final response = await model.generateContent([
  Content.multi([imagePart, prompt]),
]);
print(response.text);
```

Other media types only differ in the MIME type passed to `InlineDataPart`:

```dart
final audio = await File('audio0.mp3').readAsBytes();
final audioPart = InlineDataPart('audio/mpeg', audio); // or 'application/pdf', 'video/mp4'
final response = await model.generateContent([
  Content.multi([audioPart, TextPart("Transcribe what's said in this audio recording.")]),
]);
```

Cloud Storage for Firebase URL (Agent Platform Gemini API provider only): use
`FileData('image/jpeg', 'gs://bucket-name/path/image.jpg')` in place of the
`InlineDataPart` inside `Content.multi`.
