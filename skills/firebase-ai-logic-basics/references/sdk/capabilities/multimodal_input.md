# Multimodal Input

Multimodal input lets you send images, audio, video, and documents (PDF or plain
text) together with a text prompt in a single `generateContent` call, so the
model can caption, classify, answer questions about, transcribe, or summarize
them. Reach for it whenever the user's request involves *understanding* a file
rather than producing one (generating images is a separate capability). It works
with the general-purpose Gemini models listed in the
[models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
and has no billing requirement beyond your API provider's.

## Configuration

Every non-text part of a request is passed as **inline data** (the raw file
bytes, which the SDK base64-encodes in transit) **together with its MIME type**.
The Android and Apple SDKs additionally accept platform-native image types
(`Bitmap`; `UIImage`, `NSImage`, `CIImage`, `CGImage`) without a MIME type;
those are converted client-side to JPEG at 80% quality. Pass an explicit
inline-data part with a MIME type instead when you need PNG transparency or
exact control over the encoding.

> [!WARNING] **The total request size limit is 20 MB.** Inline data is
> base64-encoded in transit (which grows it by about a third), and an oversized
> request fails with **HTTP 413**. For files larger than that, store them in
> Cloud Storage for Firebase and pass their `gs://` URLs instead. Note that
> Cloud Storage URLs (`fileData` / file parts) are **only accepted when the app
> uses the Agent Platform Gemini API (formerly branded Vertex AI) as its
> provider**, which requires the Blaze plan. With the Gemini Developer API (this
> skill's default) the only URL input is a public or unlisted YouTube video URL
> (one per request). See
> [Cloud Storage for Firebase with AI Logic](https://firebase.google.com/docs/ai-logic/solutions/cloud-storage.md.txt)
> and
> [options for providing files](https://firebase.google.com/docs/ai-logic/input-file-requirements.md.txt).

Supported input types (each page lists the full MIME types, per-request limits,
tokenization, and best practices):

| Input    | Common MIME types                                             | Limits per request                                  | Official page                                                                           |
| :------- | :------------------------------------------------------------ | :-------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| Image    | `image/png`, `image/jpeg`, `image/webp`                       | 3,000 images; scaled down to fit 3072 x 3072        | [Analyze images](https://firebase.google.com/docs/ai-logic/analyze-images.md.txt)       |
| Audio    | `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/aac`, and more | 1 audio file                                        | [Analyze audio](https://firebase.google.com/docs/ai-logic/analyze-audio.md.txt)         |
| Video    | `video/mp4`, `video/quicktime`, `video/webm`, and more        | 10 video files                                      | [Analyze video](https://firebase.google.com/docs/ai-logic/analyze-video.md.txt)         |
| Document | `application/pdf`, `text/plain`                               | 1,000 pages and 50 MB per file; each page = 1 image | [Analyze documents](https://firebase.google.com/docs/ai-logic/analyze-documents.md.txt) |

Prompting tips from the official guides: place the file(s) *before* the text
prompt, and when sending several images give each an index in the prompt
(`image 1`, `image 2`, ...) so you and the model can refer to them.

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

## Web (JavaScript)

Firebase AI Logic accepts Base64 encoded data or specific file references.

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const ai = getAI(app, { backend: new GoogleAIBackend() });
// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
const model = getGenerativeModel(ai, { model: "<latest_supported_model>" });

// Helper to convert file to base64 generic object
async function fileToGenerativePart(file) {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });

  return {
    type: "inlineData",
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
}

async function analyzeImage(prompt, imageFile) {
  const imagePart = await fileToGenerativePart(imageFile);
  const result = await model.generateContent([imagePart, prompt]);
  return result.response.text();
}
```

The same helper handles audio, video, and PDF `File` objects because it reads
the MIME type from `file.type`. If you already hold base64 data, build the part
directly with an explicit MIME type:

```javascript
const pdfPart = { type: "inlineData", inlineData: { data: base64Pdf, mimeType: "application/pdf" } };
const result = await model.generateContent([
  pdfPart,
  "Summarize the important results in this report.",
]);
console.log(result.response.text());
```

Cloud Storage for Firebase URL (Agent Platform Gemini API provider only): pass
`{ type: "fileData", fileData: { mimeType: "image/jpeg", fileUri: "gs://bucket-name/path/image.jpg" } }`
in place of the `inlineData` part.

## Troubleshooting

- **HTTP 413 (request too large)**: the total request exceeded 20 MB after
  base64 encoding. Compress or downscale images (anything above 3072 x 3072 is
  scaled down server-side anyway), trim audio/video, split long PDFs, or upload
  the file to Cloud Storage for Firebase and pass its `gs://` URL. The URL route
  requires the Agent Platform Gemini API provider; see
  [Cloud Storage for Firebase with AI Logic](https://firebase.google.com/docs/ai-logic/solutions/cloud-storage.md.txt).
- **Unsupported MIME type / file format errors**: only the MIME types listed on
  the per-media page are accepted (for example images must be PNG, JPEG, or
  WebP, so convert HEIC or GIF before sending), and audio is limited to one file
  per request. Check the matching page in the table above, or the full
  [supported input files and requirements](https://firebase.google.com/docs/ai-logic/input-file-requirements.md.txt).
  On Web, `file.type` can be an empty string for files the browser does not
  recognize; set `mimeType` explicitly in that case.

See the official guides:
[Analyze images](https://firebase.google.com/docs/ai-logic/analyze-images),
[Analyze audio](https://firebase.google.com/docs/ai-logic/analyze-audio),
[Analyze video](https://firebase.google.com/docs/ai-logic/analyze-video),
[Analyze documents](https://firebase.google.com/docs/ai-logic/analyze-documents).

Last verified against
https://firebase.google.com/docs/ai-logic/generate-text.md.txt (multimodal
section), the analyze-images, analyze-audio, analyze-video, and
analyze-documents pages under https://firebase.google.com/docs/ai-logic/, and
the Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk,
firebase-js-sdk, flutterfire; `main` branches) on 2026-10-08.
