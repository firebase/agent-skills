# On-Device & Hybrid Inference

Hybrid inference lets an app run an on-device model when available and fall back
to a cloud-hosted Gemini model (or the reverse) depending on availability:

- **Android (`com.google.firebase:firebase-ai` +
  `com.google.firebase:firebase-ai-ondevice`)**: uses AICore / ML Kit GenAI
  Prompt (Gemini Nano) on supported Android devices.
- **Web (`firebase/ai`)**: uses Chrome's built-in `LanguageModel` Prompt API
  (Gemini Nano) on Chrome on Desktop (v139+).
- **iOS (`FirebaseAILogic` via Swift Package Manager)**: in `firebase-ios-sdk`
  v13.0.0+ (iOS 27+ / macOS 27+), `ai.geminiLanguageModel(name:)` conforms to
  Apple's `FoundationModels.LanguageModel` protocol so apps can route between
  Apple's on-device `SystemLanguageModel.default` and cloud Gemini models with
  `LanguageModelSession` (replacing the experimental `HybridModel` /
  `GenerativeModelSession` wrapper from v12.13.0–12.x).
- **Flutter (`firebase_ai`)**: not available via Firebase AI Logic (always calls
  the cloud-hosted Gemini API).

Reach for hybrid inference when a feature benefits from on-device execution
(enhanced privacy, local context, inference at no cost, offline use) while still
reaching every user through the cloud fallback.

## Configuration

> [!WARNING] **Preview feature.** On-device and hybrid inference on Android
> (`@PublicPreviewAPI` in `firebase-ai` + `firebase-ai-ondevice`) and Web
> (Chrome Desktop v139+) are in Preview and may change in backwards-incompatible
> ways.

### Inference modes

Set `mode` (Web) or `OnDeviceConfig(mode = ...)` (Android) when creating the
model. Both platforms share the same four `InferenceMode` constants:

| Mode               | Behavior                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| `PREFER_ON_DEVICE` | Use the on-device model if it's available; otherwise fall back to the cloud model.  |
| `ONLY_ON_DEVICE`   | Use the on-device model if it's available; otherwise throw an exception.            |
| `PREFER_IN_CLOUD`  | Use the cloud-hosted model if it's available; otherwise fall back to the on-device. |
| `ONLY_IN_CLOUD`    | Use the cloud-hosted model if it's available; otherwise throw an exception.         |

- **Inspecting which path ran**: read `response.inferenceSource` (Android) or
  `result.response.inferenceSource` (Web) and compare it with
  `InferenceSource.ON_DEVICE` / `InferenceSource.IN_CLOUD`.
- **Model lifecycle**:
  - **Android**: inspect `model.onDeviceExtension?.checkStatus()`
    (`OnDeviceModelStatus.AVAILABLE`, `DOWNLOADABLE`, `DOWNLOADING`,
    `UNAVAILABLE`) and trigger downloads with
    `model.onDeviceExtension?.download()` (returns `Flow<DownloadStatus>`).
  - **Web**: call `await hybridModel.initializeDeviceModel(onDownloadProgress?)`
    on or after an end-user interaction (such as a button click) to trigger and
    await the Gemini Nano download in Chrome. If `initializeDeviceModel()` has
    not been called and the model is still `"downloadable"`, `PREFER_ON_DEVICE`
    falls back to the cloud without starting a download.
- **Cloud fallback configuration**:
  - **Android**: pass `modelName`, `generationConfig`, `safetySettings`, and
    `systemInstruction` directly to
    `generativeModel(..., onDeviceConfig = OnDeviceConfig(...))`.
  - **Web**: pass cloud settings in `inCloudParams` (`model`,
    `generationConfig`, etc.; default cloud model is `gemini-3.5-flash-lite` in
    `firebase@13.0.0+`, or `gemini-2.5-flash-lite` in `firebase@12.x`) and
    Chrome Prompt API options in `onDeviceParams` (`createOptions`,
    `promptOptions.responseConstraint`). Note that `createOptions.temperature`
    and `topK` were removed in `firebase@13.0.0` (`@firebase/ai@3.0.0`).

### Supported on-device vs cloud

Supported for on-device inference:

- Single-turn content generation, streaming (`generateContentStream`) and
  non-streaming (`generateContent`)
- Text from text-only input (plus text `systemInstruction` on Android; up to
  4096 tokens on iOS)
- Text from text-and-image input (single `Bitmap` + text on Android with a
  4000-token request limit; JPEG/PNG on Web with a 9216-token limit)
- Structured output (via `generateObject` / `@Generable` KSP on Android, or
  `onDeviceParams.promptOptions.responseConstraint` on Web)
- `countTokens` is supported on Android on-device, but throws on Web
  `ONLY_ON_DEVICE` (and calls the cloud in hybrid modes). Avoid relying on
  `countTokens` to decide hybrid fallback thresholds because token counts differ
  between cloud-hosted and on-device models.

Not supported on-device (with `PREFER_ON_DEVICE` the SDK falls back to the cloud
automatically; with `ONLY_ON_DEVICE` the request throws):

- Audio, video, and document (PDF) inputs, or file URLs (`gs://`)
- Image generation with Gemini or Imagen models
- Multi-turn chat (`startChat`) and bidirectional Live API streaming
- Tools (function calling, Google Search grounding)
- AI monitoring in the Firebase console for on-device requests

## Android (Kotlin)

Add `com.google.firebase:firebase-ai-ondevice` alongside
`com.google.firebase:firebase-ai` in `app/build.gradle.kts` (`minSdk = 26` is
required by `firebase-ai-ondevice`):

```kotlin
dependencies {
    // [AGENT] Fetch the latest available BoM version from https://firebase.google.com/support/release-notes/android
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))
    implementation("com.google.firebase:firebase-ai")
    implementation("com.google.firebase:firebase-ai-ondevice:16.0.0-beta06")
}
```

Opt in to `@PublicPreviewAPI`, configure
`OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE)`, optionally ensure the
on-device model is downloaded via `model.onDeviceExtension`, and check
`response.inferenceSource`:

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI

@OptIn(PublicPreviewAPI::class)
suspend fun runHybridGeneration() {
    // [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
    val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
        modelName = "<latest_supported_model>",
        onDeviceConfig = OnDeviceConfig(
            mode = InferenceMode.PREFER_ON_DEVICE,
            maxOutputTokens = 256
        )
    )

    // Optional: check on-device status and download if needed
    val extension = model.onDeviceExtension
    if (extension?.checkStatus() == OnDeviceModelStatus.DOWNLOADABLE) {
        extension.download().collect { status ->
            when (status) {
                is DownloadStatus.DownloadStarted ->
                    Log.d(TAG, "Downloading ${status.bytesToDownload} bytes")
                is DownloadStatus.DownloadInProgress ->
                    Log.d(TAG, "Downloaded ${status.totalBytesDownloaded} bytes")
                is DownloadStatus.DownloadCompleted ->
                    Log.d(TAG, "On-device model ready")
                is DownloadStatus.DownloadFailed ->
                    Log.w(TAG, "On-device download failed", status.exception)
            }
        }
    }

    val response = model.generateContent("Write a haiku about offline-first apps.")
    val usedOnDevice = response.inferenceSource == InferenceSource.ON_DEVICE
    Log.d(TAG, "Source: ${response.inferenceSource} (onDevice=$usedOnDevice): ${response.text}")
}
```

## iOS (Swift)

Apple platforms do not ship Gemini Nano; instead, local inference uses Apple's
on-device `FoundationModels` framework on Apple Intelligence–enabled devices.

- **`firebase-ios-sdk` v13.0.0+ (iOS 27+ / macOS 27+, Preview)**: use
  `ai.geminiLanguageModel(name:)`, which conforms to Apple's
  `FoundationModels.LanguageModel` protocol so you can route between Apple's
  on-device `SystemLanguageModel.default` and a cloud Gemini model with the same
  `LanguageModelSession` API (see
  https://firebase.google.com/docs/ai-logic/apple-foundation-models-framework/get-started.md.txt).
  **Requires Xcode 27** (the API is only compiled under
  `#if compiler(>=6.4) && canImport(FoundationModels)`) and is marked
  `@available(iOS 27.0, macOS 27.0, *)`, so apps with an earlier deployment
  target must wrap the call site in `if #available(...)`:

```swift
import FirebaseAILogic
import FoundationModels

let ai = FirebaseAI.firebaseAI(backend: .googleAI())

if #available(iOS 27.0, macOS 27.0, *) {
    // [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
    let cloudModel = ai.geminiLanguageModel(name: "<latest_supported_model>")

    // Route to Apple's on-device model when available, or fall back to cloud Gemini:
    let session: LanguageModelSession
    if SystemLanguageModel.default.isAvailable {
        session = LanguageModelSession(model: SystemLanguageModel.default)
    } else {
        session = LanguageModelSession(model: cloudModel)
    }
    let response = try await session.respond(to: "Write a haiku about offline-first apps.")
    print(response.content)
} else {
    // Earlier OS versions: use the standard cloud model directly.
    let model = ai.generativeModel(modelName: "<latest_supported_model>")
    let response = try await model.generateContent("Write a haiku about offline-first apps.")
    print(response.text ?? "No text in response.")
}
```

- **Earlier SDK versions (`firebase-ios-sdk` v12.13.0–12.x)**: the experimental
  `HybridModel` / `GenerativeModelSession` / `FirebaseAI.SystemLanguageModel`
  wrapper documented at
  https://firebase.google.com/docs/ai-logic/hybrid/ios/get-started.md.txt was
  removed in `firebase-ios-sdk` v13.0.0 in favor of `GeminiLanguageModel` above
  (or standard cloud `ai.generativeModel(modelName:)` on earlier OS versions).
  See https://firebase.google.com/docs/ai-logic/hybrid.md.txt.

## Flutter (Dart)

Hybrid on-device inference is not available via Firebase AI Logic on Flutter
(including Flutter web); the `firebase_ai` package always calls the cloud-hosted
Gemini API. See https://firebase.google.com/docs/ai-logic/hybrid.md.txt.

## Web (JavaScript)

On Web, on-device inference uses Chrome's built-in
[Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api) on
Chrome Desktop (v139+, with at least 22 GB free storage and >4 GB VRAM or 16 GB
RAM). For local development, enable
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart
Chrome; for end users, serve the
[Prompt API Chrome Origin Trial](https://developer.chrome.com/origintrials/#/view_trial/2533837740349325313)
token.

Create the hybrid model with `mode: InferenceMode.PREFER_ON_DEVICE`, call
`await hybridModel.initializeDeviceModel()` on a user gesture to ensure Gemini
Nano is downloaded and initialized, then call `generateContent` and inspect
`result.response.inferenceSource`:

```javascript
import { getGenerativeModel, InferenceMode, InferenceSource } from "firebase/ai";

const hybridModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
});

// Call initializeDeviceModel() on or after an end-user interaction (e.g. button click)
document.querySelector("#generate").addEventListener("click", async () => {
  await hybridModel.initializeDeviceModel((progress) => {
    console.log(`On-device model download progress: ${Math.round(progress * 100)}%`);
  });

  const prompt = "Write a story about a magic backpack.";
  const result = await hybridModel.generateContent(prompt);

  // Compare with InferenceSource.ON_DEVICE ("on_device") or InferenceSource.IN_CLOUD ("in_cloud")
  const usedOnDevice = result.response.inferenceSource === InferenceSource.ON_DEVICE;
  console.log(`Source: ${result.response.inferenceSource} (onDevice=${usedOnDevice})`);
  console.log(result.response.text());
});
```

To override the default cloud model (`gemini-3.5-flash-lite` in
`firebase@13.0.0+`; `gemini-2.5-flash-lite` in `firebase@12.x`) or request
structured output from both paths, configure `inCloudParams` and
`onDeviceParams` together:

```javascript
import { getGenerativeModel, InferenceMode, Schema } from "firebase/ai";

const jsonSchema = Schema.object({
  properties: { name: Schema.string(), species: Schema.string() },
});

const hybridModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  // Cloud-hosted model settings (overrides the SDK's default cloud model)
  inCloudParams: {
    model: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
    },
  },
  // On-device model settings (Chrome Prompt API options)
  onDeviceParams: {
    promptOptions: { responseConstraint: jsonSchema },
  },
});
```

For enum output use `Schema.enumString({ enum: [...] })` with
`responseMimeType: "text/x.enum"` in `inCloudParams` and the same schema as the
`responseConstraint`.

## Troubleshooting

- **Web: requests always fall back to the cloud when Gemini Nano is
  `"downloadable"`**: call `await hybridModel.initializeDeviceModel()` inside a
  user gesture handler (or pre-download with `await LanguageModel.create()` in
  Chrome DevTools) — `generateContent` does not trigger a new model download on
  its own.
- **Android: `OnDeviceModelStatus.UNAVAILABLE`**: the device does not support
  AICore / Gemini Nano, or `com.google.firebase:firebase-ai-ondevice` is missing
  from `dependencies`. With `PREFER_ON_DEVICE`, requests automatically fall back
  to the cloud model.
- **`ONLY_ON_DEVICE` throws**: the on-device model is unavailable or not yet
  downloaded, or the request uses a feature that is not supported on-device
  (chat, tools, audio/video/PDF, file URLs). Use `PREFER_ON_DEVICE` if a cloud
  fallback is acceptable.
- **Requests unexpectedly run in the cloud**: `PREFER_ON_DEVICE` silently falls
  back for unsupported features or when Gemini Nano is unavailable. Check
  `response.inferenceSource` / `result.response.inferenceSource`.
- **`countTokens` throws on Web or differs from on-device**: token counting
  throws on Web in `ONLY_ON_DEVICE` mode (and queries the cloud model in
  `PREFER_ON_DEVICE` / `PREFER_IN_CLOUD`). Even on Android (where on-device
  `countTokens` is supported), token counts differ between cloud-hosted and
  on-device models, so do not rely on `countTokens` for fallback decisions.
- **Web: works on localhost but not for end users**: the Chrome Origin Trial
  token is missing, expired, or not served on that page.

See the official hybrid on-device inference guide:
https://firebase.google.com/docs/ai-logic/hybrid.md.txt
