# On-Device & Hybrid Inference

See the
[Hybrid and on-device inference](https://firebase.google.com/docs/ai-logic/hybrid.md.txt)
guide for full details.

Reach for hybrid inference when a feature benefits from on-device execution
(enhanced privacy, local context, inference at no cost, offline use) while still
reaching every user through the cloud fallback. Jump to your platform below —
Android and Web use Firebase AI Logic's `InferenceMode` APIs with Gemini Nano,
iOS integrates with Apple's `FoundationModels` framework, and Flutter does not
support hybrid on-device inference.

## Android (Kotlin)

Official documentation:
[Get started with hybrid inference on Android](https://firebase.google.com/docs/ai-logic/hybrid/android/get-started.md.txt)
(see this guide for supported/unsupported on-device features and device
requirements).

> [!WARNING] **Experimental on Android.** Hybrid inference on Android uses
> `@PublicPreviewAPI` in `firebase-ai` + `firebase-ai-ondevice` and may change
> in backwards-incompatible ways.

> [!IMPORTANT] **[AGENT] RESOLVING THE SDK VERSION DETERMINISTICALLY** Before
> adding dependencies, query the latest available versions directly from the
> Google Maven Repository:
>
> ```bash
> # Find the latest Firebase Android BoM version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest firebase-ai-ondevice version (not yet managed by the BoM)
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-ai-ondevice/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```

Add `com.google.firebase:firebase-ai-ondevice` alongside
`com.google.firebase:firebase-ai` in `app/build.gradle.kts` (`minSdk = 26` is
required by `firebase-ai-ondevice`):

```kotlin
dependencies {
    // [AGENT] Fetch the latest resolved versions using the gMaven commands above
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))
    implementation("com.google.firebase:firebase-ai")
    implementation("com.google.firebase:firebase-ai-ondevice:<latest_firebase_ai_ondevice_version>")
}
```

Opt in to `@PublicPreviewAPI`, configure `OnDeviceConfig(mode = ...)` (choose
`InferenceMode.PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, or
`ONLY_IN_CLOUD`), optionally check/download the on-device model via
`model.onDeviceExtension`, and inspect `response.inferenceSource`
(`InferenceSource.ON_DEVICE` vs `InferenceSource.IN_CLOUD`):

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
    // [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
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

### Android Troubleshooting

- **`OnDeviceModelStatus.UNAVAILABLE` or `model.onDeviceExtension` is `null`**:
  `UNAVAILABLE` means the device does not support AICore / Gemini Nano; with
  `PREFER_ON_DEVICE`, requests automatically fall back to the cloud model. If
  `model.onDeviceExtension` is `null`,
  `com.google.firebase:firebase-ai-ondevice` is missing from `dependencies`.
- **Requests unexpectedly run in the cloud or `ONLY_ON_DEVICE` throws**:
  `PREFER_ON_DEVICE` falls back to the cloud when Gemini Nano is unavailable or
  when a request uses a cloud-only feature (such as audio/PDF/URL inputs,
  multi-turn chat, or tools). `ONLY_ON_DEVICE` throws when the on-device model
  is unavailable or the input is unsupported, and may silently drop unsupported
  fields like `tools` — use `ONLY_IN_CLOUD` for features that require the cloud
  and check `response.inferenceSource`.

## iOS (Swift)

Official documentation:
[Access Gemini models using Apple's Foundation Models framework](https://firebase.google.com/docs/ai-logic/apple-foundation-models-framework/get-started.md.txt)

Apple platforms do not ship Gemini Nano; instead, local inference uses Apple's
on-device `FoundationModels` framework on Apple Intelligence–enabled devices.

In `firebase-ios-sdk` v13.0.0+ (iOS 27+ / macOS 27+), use
`ai.geminiLanguageModel(name:)`, which conforms to Apple's
`FoundationModels.LanguageModel` protocol so you can route between Apple's
on-device `SystemLanguageModel.default` and a cloud Gemini model with the same
`LanguageModelSession` API. **Requires Xcode 27** (the API is only compiled
under `#if compiler(>=6.4) && canImport(FoundationModels)`) and is marked
`@available(iOS 27.0, macOS 27.0, *)`, so apps with an earlier deployment target
must wrap the call site in `if #available(...)`:

```swift
import FirebaseAILogic
import FoundationModels

let ai = FirebaseAI.firebaseAI(backend: .googleAI())

// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
if #available(iOS 27.0, macOS 27.0, *) {
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

> [!WARNING] **`HybridModel` and `GenerativeModelSession` were removed in
> `firebase-ios-sdk` v13.0.0.** Do **not** use `HybridModel`,
> `GenerativeModelSession`, or `FirebaseAI.SystemLanguageModel`—ignore older
> samples or docs (such as `hybrid/ios/get-started`) that still reference them,
> and use `ai.geminiLanguageModel(name:)` above instead.

### iOS Troubleshooting

- **`Cannot find 'HybridModel'` or `'GenerativeModelSession'`**: these interim
  APIs were removed in `firebase-ios-sdk` v13.0.0. Use
  `ai.geminiLanguageModel(name:)` with Apple's `FoundationModels`
  `LanguageModelSession` as shown above.
- **Availability or compiler errors**: `ai.geminiLanguageModel(name:)` requires
  Xcode 27 and `@available(iOS 27.0, macOS 27.0, *)`; wrap the call in
  `if #available(...)` and fall back to `ai.generativeModel(modelName:)` on
  earlier OS versions.

## Flutter (Dart)

Hybrid on-device inference is not available via Firebase AI Logic on Flutter
(including Flutter web); the `firebase_ai` package always calls the cloud-hosted
Gemini API. See https://firebase.google.com/docs/ai-logic/hybrid.md.txt.

## Web (JavaScript)

Official documentation:
[Get started with hybrid inference on Web](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started.md.txt)
(see this guide for supported/unsupported on-device features, Chrome version and
hardware requirements).

On Web, on-device inference uses Chrome's built-in
[Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api) on
Chrome on Desktop (v139+). For local development, enable
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart
Chrome.

Create the hybrid model with `mode` (`InferenceMode.PREFER_ON_DEVICE`,
`ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, or `ONLY_IN_CLOUD`), call
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

To override the SDK's default cloud-hosted fallback model or request structured
output from both paths, configure `inCloudParams` and `onDeviceParams` together
(when you pass `inCloudParams`, you must also set its `model`; otherwise the SDK
throws a `NO_MODEL` error). Do not pass `temperature` or `topK` in
`onDeviceParams.createOptions`:

```javascript
import { getGenerativeModel, InferenceMode, Schema } from "firebase/ai";

const jsonSchema = Schema.object({
  properties: { name: Schema.string(), species: Schema.string() },
});

// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
const hybridModel = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  // Cloud-hosted model settings (overrides the SDK's default cloud model)
  inCloudParams: {
    model: "<latest_supported_model>",
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

### Web Troubleshooting

- **Requests always fall back to the cloud when Gemini Nano is
  `"downloadable"`**: call `await hybridModel.initializeDeviceModel()` inside a
  user gesture handler — `generateContent` does not trigger a new model download
  on its own.
- **Works locally but not for some end users**: on-device inference requires
  Chrome on Desktop v139+ with Gemini Nano available. If the browser does not
  expose the `LanguageModel` API, requests run in the cloud — check
  `result.response.inferenceSource`.
- **`NO_MODEL` error when creating the model**: if you pass `inCloudParams`, you
  must include `model` inside `inCloudParams`.
- **`countTokens` throws in `ONLY_ON_DEVICE` mode**: token counting is not
  supported on-device on Web (and queries the cloud model in hybrid modes).
