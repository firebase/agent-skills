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
