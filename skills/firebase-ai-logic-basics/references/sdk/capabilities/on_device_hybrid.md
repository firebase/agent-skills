# On-Device & Hybrid Inference

## Android (Kotlin)

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
