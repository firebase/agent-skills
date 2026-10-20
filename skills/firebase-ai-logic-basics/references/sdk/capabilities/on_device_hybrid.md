# On-Device & Hybrid Inference

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
