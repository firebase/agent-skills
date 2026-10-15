# Client-Side Text-to-Speech (TTS) Generation with Gemini

Firebase AI Logic enables client-side Text-to-Speech (TTS) generation directly
from your mobile and web applications without maintaining custom backend speech
services. Using specialized Gemini TTS models, apps can synthesize natural,
expressive audio with custom voice personas, multi-speaker dialogues, and
in-flight audio streaming.

______________________________________________________________________

## Supported Models

Always specify a dedicated Gemini TTS model when generating audio:

| Model ID                       | Description                                                                        |
| :----------------------------- | :--------------------------------------------------------------------------------- |
| `gemini-3.1-flash-tts-preview` | Low-latency speech synthesis (preview); supports single- and multi-speaker output. |

> [!WARNING] Always verify currently supported model availability in the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt).

______________________________________________________________________

## Core Concepts & Configurations

### 1. Response Modality

To instruct Gemini to synthesize and return audio, configure
`responseModalities` in the generation configuration to include audio:

- **Android (Kotlin)**:
  `generationConfig { responseModalities = listOf(ResponseModality.AUDIO) }`
- **iOS (Swift)**:
  `GenerationConfig(responseModalities: [.audio], speechConfig: ...)`
- **Web (JS/TS)**: `generationConfig: { responseModalities: ["AUDIO"] }`

### 2. Single-Speaker `SpeechConfig`

Configure voice persona and optional language code (`languageCode`, e.g.
`"en-US"`, `"es-ES"`, `"ja-JP"`) using `SpeechConfig`. Voice names map to Google
prebuilt neural voices (for example: `Puck`, `Charon`, `Kore`, `Fenrir`,
`Aoede`):

- **Android (Kotlin)**:
  ```kotlin
  @OptIn(PublicPreviewAPI::class)
  val config = generationConfig {
      responseModalities = listOf(ResponseModality.AUDIO)
      speechConfig = SpeechConfig(
          voice = Voice("Kore"),
          languageCode = "en-US"
      )
  }
  ```
- **iOS (Swift)**:
  ```swift
  let config = GenerationConfig(
      responseModalities: [.audio],
      speechConfig: SpeechConfig(voiceName: "Kore", languageCode: "en-US")
  )
  ```
- **Web**:
  ```javascript
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Puck"
      }
    },
    languageCode: "en-US"
  }
  ```

### 3. Multi-Speaker `MultiSpeakerVoiceConfig` (2-Speaker Dialogues)

For scripts with two distinct characters or roles (e.g., host and guest,
narrator and character), configure `MultiSpeakerVoiceConfig` with
`speakerVoiceConfigs` linking speaker names to specific voices:

- **Android (Kotlin)**:

  ```kotlin
  @OptIn(PublicPreviewAPI::class)
  val multiSpeechConfig = SpeechConfig(
      multiSpeakerVoiceConfig = MultiSpeakerVoiceConfig(
          speakerVoiceConfigs = listOf(
              SpeakerVoiceConfig(speaker = "Joe", voice = Voice("Puck")),
              SpeakerVoiceConfig(speaker = "Jane", voice = Voice("Kore"))
          )
      ),
      languageCode = "en-US"
  )
  ```

- **iOS (Swift)**:

  ```swift
  let multiSpeechConfig = SpeechConfig(
      multiSpeakerVoiceConfig: MultiSpeakerVoiceConfig(
          speakerVoiceConfigs: [
              SpeakerVoiceConfig(speaker: "Joe", voiceName: "Puck"),
              SpeakerVoiceConfig(speaker: "Jane", voiceName: "Kore")
          ]
      ),
      languageCode: "en-US"
  )
  ```

- **Web**:

  ```javascript
  speechConfig: {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        {
          speaker: "Host",
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
        },
        {
          speaker: "Guest",
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
        }
      ]
    }
  }
  ```

______________________________________________________________________

## Audio Directives and Emotional Tags

Gemini TTS models accept natural-language directives and inline tags in prompts
to control tone, cadence, pacing, and emotional expression.

### Directives

Include directives at the start of your prompt to set the overall tone and
scene:

- `[Audio Profile: Warm, conversational podcast co-host with energetic delivery]`
- `[Scene: Quiet bedtime story in a calm room]`
- `[Director's Note: Speak deliberately, pausing for reflection after major questions]`

### Emotional Tags & Delivery Cues

Embed delivery markers inline within dialogue or narration:

- `[whispers]` — Soft, confidential whisper.
- `[laughs]` / `[chuckles]` — Lighthearted laughter during delivery.
- `[sighs]` — Expressive exhale.
- `[slowly]` — Reduced tempo for emphasis or dramatic effect.
- `[excited]` — Higher energy and faster pacing.
- `[pause]` — Deliberate silence.

### Multi-Speaker Prompt Example

```text
[Scene: A lively coffee-shop tech discussion]
[Director's Note: Host is upbeat and curious; Guest is thoughtful and explanatory]

Host: Welcome back! [excited] Today we are diving into client-side audio.
Guest: [laughs] It's about time! No servers in between means virtually zero latency.
Host: [whispers] Tell us the secret... how does it stream?
Guest: [slowly] Pure linear PCM, chunk by chunk, directly to your device's audio engine.
```

______________________________________________________________________

## Audio Decoding and Playback

### Format Specifications

Gemini TTS audio format depends on whether the request is unary or streaming:

- **Unary Requests (`generateContent`)**: Returns complete **WAV (`audio/wav`)**
  audio with a standard 44-byte RIFF header included by default (24 kHz, mono,
  16-bit signed little-endian PCM). These bytes can be passed directly to
  standard media players (`AVAudioPlayer`, `MediaPlayer`, `<audio>`).

- **Streaming Requests (`generateContentStream`)**: Returns headerless raw
  **Linear PCM (`audio/l16; rate=24000; channels=1`)** chunks (24 kHz, mono,
  16-bit signed little-endian PCM) so chunks can be streamed or concatenated
  continuously without per-chunk container headers.

- **Audio Parameters**:

  - **Sample Rate**: 24,000 Hz (24 kHz)
  - **Channels**: 1 channel (mono)
  - **Bit Depth**: 16-bit linear PCM (little-endian signed integer)
  - **MIME Types**: `audio/l16` (streaming chunks) or `audio/wav` /
    `audio/x-wav` (unary)

### Playback Approaches

1. **Direct Low-Latency PCM Streaming**:
   - Stream raw PCM chunks directly into low-level audio renderers without
     waiting for the full response:
     - **iOS**: `AVAudioEngine` + `AVAudioPlayerNode` scheduling
       `AVAudioPCMBuffer`.
     - **Android**: `AudioTrack` configured with `ENCODING_PCM_16BIT` and
       `CHANNEL_OUT_MONO`.
     - **Web**: Web Audio API (`AudioContext`) scheduling PCM chunks into
       `AudioBufferSourceNode`.
1. **WAV Container Format**:
   - Standard media players (`AVAudioPlayer` on iOS, `MediaPlayer` on Android,
     `<audio>` on Web) expect a container header (RIFF/WAV).
   - For unary responses, the RIFF header is already present. For assembled
     streaming PCM chunks, prepend a standard **44-byte RIFF header** to make
     the complete audio immediately playable or saveable as `.wav`.

#### Standard 44-Byte WAV (RIFF) Header Construction

```
Offset  Size  Field              Value
0       4     ChunkID            "RIFF"
4       4     ChunkSize          36 + Subchunk2Size (file size - 8)
8       4     Format             "WAVE"
12      4     Subchunk1ID        "fmt "
16      4     Subchunk1Size      16 (for PCM)
20      2     AudioFormat        1 (PCM linear)
22      2     NumChannels        1 (Mono)
24      4     SampleRate         24000
28      4     ByteRate           48000 (SampleRate * NumChannels * BitsPerSample / 8)
32      2     BlockAlign         2 (NumChannels * BitsPerSample / 8)
34      2     BitsPerSample      16
36      4     Subchunk2ID        "data"
40      4     Subchunk2Size      Number of PCM bytes
44+     N     Data               Raw PCM bytes
```

______________________________________________________________________

## Android (Kotlin)

### 1. Single-Speaker & Multi-Speaker Generation (`generateContent`)

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.MultiSpeakerVoiceConfig
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.ResponseModality
import com.google.firebase.ai.type.SpeakerVoiceConfig
import com.google.firebase.ai.type.SpeechConfig
import com.google.firebase.ai.type.Voice
import com.google.firebase.ai.type.generationConfig

@OptIn(PublicPreviewAPI::class)
suspend fun generateSingleSpeakerSpeech(): ByteArray? {
    val config = generationConfig {
        responseModalities = listOf(ResponseModality.AUDIO)
        speechConfig = SpeechConfig(
            voice = Voice("Kore"),
            languageCode = "en-US"
        )
    }

    val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
        modelName = "gemini-3.1-flash-tts-preview",
        generationConfig = config
    )

    val response = model.generateContent("Say cheerfully: Have a wonderful day!")
    return response.inlineDataParts.firstOrNull()?.inlineData // Raw PCM bytes (24kHz, 1 channel, 16-bit)
}

@OptIn(PublicPreviewAPI::class)
suspend fun generateMultiSpeakerSpeech(): ByteArray? {
    val multiSpeechConfig = SpeechConfig(
        multiSpeakerVoiceConfig = MultiSpeakerVoiceConfig(
            speakerVoiceConfigs = listOf(
                SpeakerVoiceConfig(speaker = "Joe", voice = Voice("Puck")),
                SpeakerVoiceConfig(speaker = "Jane", voice = Voice("Kore"))
            )
        ),
        languageCode = "en-US"
    )

    val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
        modelName = "gemini-3.1-flash-tts-preview",
        generationConfig = generationConfig {
            responseModalities = listOf(ResponseModality.AUDIO)
            speechConfig = multiSpeechConfig
        }
    )

    val prompt = """
        Joe: How's it going today Jane?
        Jane: [excited] Not too bad, how about you?
    """.trimIndent()

    val response = model.generateContent(prompt)
    return response.inlineDataParts.firstOrNull()?.inlineData
}
```

### 2. Streaming Playback with `AudioTrack` (`generateContentStream`)

```kotlin
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.ResponseModality
import com.google.firebase.ai.type.SpeechConfig
import com.google.firebase.ai.type.Voice
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(PublicPreviewAPI::class)
class SpeechStreamingManager {
    private val sampleRate = 24000
    private val minBufferSize = AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT
    )

    private val audioTrack = AudioTrack.Builder()
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .build()
        )
        .setAudioFormat(
            AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build()
        )
        .setBufferSizeInBytes(minBufferSize * 2)
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()

    suspend fun streamSpeech(prompt: String) = withContext(Dispatchers.IO) {
        val config = generationConfig {
            responseModalities = listOf(ResponseModality.AUDIO)
            speechConfig = SpeechConfig(voice = Voice("Kore"))
        }

        val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
            modelName = "gemini-3.1-flash-tts-preview",
            generationConfig = config
        )

        audioTrack.play()
        try {
            model.generateContentStream(prompt).collect { chunk ->
                chunk.inlineDataParts.firstOrNull()?.inlineData?.let { pcmChunk ->
                    // Raw PCM bytes (24kHz, 1 channel, 16-bit)
                    audioTrack.write(pcmChunk, 0, pcmChunk.size)
                }
            }
        } finally {
            audioTrack.stop()
        }
    }

    fun release() {
        audioTrack.release()
    }
}
```

### 3. Convert Raw PCM to WAV for `MediaPlayer`

```kotlin
import android.content.Context
import android.media.MediaPlayer
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

fun addWavHeader(
    pcmBytes: ByteArray,
    sampleRate: Int = 24000,
    channels: Short = 1,
    bitDepth: Short = 16
): ByteArray {
    val totalDataLen = pcmBytes.size
    val totalLength = totalDataLen + 36
    val byteRate = sampleRate * channels * bitDepth / 8
    val blockAlign = (channels * bitDepth / 8).toShort()

    val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
        put("RIFF".toByteArray())
        putInt(totalLength)
        put("WAVE".toByteArray())
        put("fmt ".toByteArray())
        putInt(16) // Subchunk1Size
        putShort(1) // AudioFormat 1 = PCM
        putShort(channels)
        putInt(sampleRate)
        putInt(byteRate)
        putShort(blockAlign)
        putShort(bitDepth)
        put("data".toByteArray())
        putInt(totalDataLen)
    }.array()

    return header + pcmBytes
}

fun playWavAudio(context: Context, pcmBytes: ByteArray) {
    val wavBytes = addWavHeader(pcmBytes)
    val tempFile = File.createTempFile("tts_", ".wav", context.cacheDir).apply {
        deleteOnExit()
        FileOutputStream(this).use { it.write(wavBytes) }
    }

    val mediaPlayer = MediaPlayer()
    try {
        mediaPlayer.setDataSource(tempFile.absolutePath)
        mediaPlayer.prepare()
        mediaPlayer.start()
        mediaPlayer.setOnCompletionListener {
            it.release()
            tempFile.delete()
        }
    } catch (e: Exception) {
        mediaPlayer.release()
        tempFile.delete()
        throw e
    }
}
```

______________________________________________________________________

## iOS (Swift)

### 1. Single-Speaker & Multi-Speaker Generation (`generateContent`)

```swift
import FirebaseAILogic

// @MainActor so these can call the @MainActor playRawPcm(data:) helper below.
@MainActor
func generateSingleSpeakerSpeech() async throws {
    let ai = FirebaseAI.firebaseAI(backend: .googleAI())

    let config = GenerationConfig(
        responseModalities: [.audio],
        speechConfig: SpeechConfig(voiceName: "Kore", languageCode: "en-US")
    )

    let model = ai.generativeModel(
        modelName: "gemini-3.1-flash-tts-preview",
        generationConfig: config
    )

    let response = try await model.generateContent("Say cheerfully: Have a wonderful day!")
    // Join all audio parts before playing; playing per-part would replace the
    // player on each pass so only the last part is heard.
    let pcmData = response.inlineDataParts.reduce(Data()) { $0 + $1.data }
    playRawPcm(data: pcmData) // Raw PCM audio bytes (24kHz, 1 channel, 16-bit)
}

@MainActor
func generateMultiSpeakerSpeech() async throws {
    let ai = FirebaseAI.firebaseAI(backend: .googleAI())

    let multiSpeechConfig = SpeechConfig(
        multiSpeakerVoiceConfig: MultiSpeakerVoiceConfig(
            speakerVoiceConfigs: [
                SpeakerVoiceConfig(speaker: "Joe", voiceName: "Puck"),
                SpeakerVoiceConfig(speaker: "Jane", voiceName: "Kore")
            ]
        ),
        languageCode: "en-US"
    )

    let model = ai.generativeModel(
        modelName: "gemini-3.1-flash-tts-preview",
        generationConfig: GenerationConfig(
            responseModalities: [.audio],
            speechConfig: multiSpeechConfig
        )
    )

    let prompt = """
    Joe: How's it going today Jane?
    Jane: [excited] Not too bad, how about you?
    """

    let response = try await model.generateContent(prompt)
    let pcmData = response.inlineDataParts.reduce(Data()) { $0 + $1.data }
    playRawPcm(data: pcmData)
}
```

### 2. Streaming Playback with `AVAudioEngine` (`generateContentStream`)

```swift
import AVFoundation
import FirebaseAILogic

@MainActor
final class SpeechStreamingManager {
    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()

    // AVAudioEngine requires 32-bit float non-interleaved PCM for node connections;
    // convert incoming 24 kHz 16-bit signed integer PCM samples to Float32 [-1.0, 1.0].
    private let audioFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: 24000,
        channels: 1,
        interleaved: false
    )!

    init() {
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: audioFormat)
    }

    func streamSpeech(prompt: String) async throws {
        let ai = FirebaseAI.firebaseAI(backend: .googleAI())

        let config = GenerationConfig(
            responseModalities: [.audio],
            speechConfig: SpeechConfig(voiceName: "Kore")
        )

        let model = ai.generativeModel(
            modelName: "gemini-3.1-flash-tts-preview",
            generationConfig: config
        )

        #if os(iOS)
        // Without the .playback category, audio is muted when the silent switch is on.
        try AVAudioSession.sharedInstance().setCategory(.playback)
        try AVAudioSession.sharedInstance().setActive(true)
        #endif
        if !audioEngine.isRunning {
            try audioEngine.start()
        }
        playerNode.play()

        let responseStream = try model.generateContentStream(prompt)
        for try await chunk in responseStream {
            for part in chunk.inlineDataParts {
                // Raw PCM audio bytes (24kHz, 1 channel, 16-bit signed little-endian)
                schedulePCMBuffer(data: part.data)
            }
        }
    }

    private func schedulePCMBuffer(data: Data) {
        let sampleCount = data.count / MemoryLayout<Int16>.size
        let frameCount = AVAudioFrameCount(sampleCount)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: frameCount),
              let floatChannel = buffer.floatChannelData?[0] else {
            return
        }
        buffer.frameLength = frameCount

        data.withUnsafeBytes { rawBufferPointer in
            // loadUnaligned reads Int16 samples without re-binding Data's memory
            // and works even if the chunk's bytes aren't 2-byte aligned in memory.
            // (If a chunk ever has an odd byte count, carry the last byte over.)
            for i in 0..<sampleCount {
                let sample = rawBufferPointer.loadUnaligned(fromByteOffset: i * 2, as: Int16.self)
                floatChannel[i] = Float(Int16(littleEndian: sample)) / 32768.0
            }
        }

        playerNode.scheduleBuffer(buffer)
    }

    func stop() {
        playerNode.stop()
        audioEngine.stop()
    }
}
```

### 3. Prepend WAV Header for `AVAudioPlayer`

```swift
import AVFoundation

// @MainActor: a global mutable var is an error under Swift 6 strict concurrency
// unless it is isolated to an actor.
@MainActor var audioPlayer: AVAudioPlayer?

@MainActor
func playRawPcm(data: Data) {
    let wavData = addWavHeader(to: data)
    do {
        #if os(iOS)
        // Without the .playback category, audio is muted when the silent switch is on.
        try AVAudioSession.sharedInstance().setCategory(.playback)
        try AVAudioSession.sharedInstance().setActive(true)
        #endif
        audioPlayer = try AVAudioPlayer(data: wavData)
        audioPlayer?.prepareToPlay()
        audioPlayer?.play()
    } catch {
        print("Error playing audio: \(error)")
    }
}

func addWavHeader(to pcmData: Data, sampleRate: Int = 24000, channels: Int = 1, bitDepth: Int = 16) -> Data {
    var header = Data()
    let byteRate = sampleRate * channels * bitDepth / 8
    let blockAlign = channels * bitDepth / 8
    let totalDataLen = Int32(pcmData.count)
    let totalLength = totalDataLen + 36

    header.append(contentsOf: "RIFF".utf8)
    header.append(Data(from: totalLength.littleEndian))
    header.append(contentsOf: "WAVE".utf8)
    header.append(contentsOf: "fmt ".utf8)
    header.append(Data(from: Int32(16).littleEndian))       // Subchunk1Size for PCM
    header.append(Data(from: Int16(1).littleEndian))        // AudioFormat 1 = PCM
    header.append(Data(from: Int16(channels).littleEndian))
    header.append(Data(from: Int32(sampleRate).littleEndian))
    header.append(Data(from: Int32(byteRate).littleEndian))
    header.append(Data(from: Int16(blockAlign).littleEndian))
    header.append(Data(from: Int16(bitDepth).littleEndian))
    header.append(contentsOf: "data".utf8)
    header.append(Data(from: totalDataLen.littleEndian))

    return header + pcmData
}

private extension Data {
    init<T>(from value: T) {
        var val = value
        self = Swift.withUnsafeBytes(of: &val) { Data($0) }
    }
}
```

______________________________________________________________________

### Web (JavaScript/TypeScript)

#### 1. Streaming Playback with Web Audio API

```typescript
import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const firebaseConfig = {
  // your firebase configuration
};

const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new GoogleAIBackend() });

const model = getGenerativeModel(ai, {
  model: "gemini-3.1-flash-tts-preview",
  generationConfig: {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Puck",
        },
      },
    },
  },
});

export class WebSpeechPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      if (typeof window === "undefined") {
        throw new Error("AudioContext is only available in browser environments.");
      }
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
    }
    return this.audioCtx;
  }

  async playSpeechStream(prompt: string) {
    const ctx = this.getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.nextStartTime = ctx.currentTime;

    const responseStream = await model.generateContentStream(prompt);

    for await (const chunk of responseStream.stream) {
      const candidates = chunk.candidates || [];
      for (const candidate of candidates) {
        for (const part of candidate.content?.parts || []) {
          if ("inlineData" in part && part.inlineData?.data) {
            const rawPcm = this.base64ToArrayBuffer(part.inlineData.data);
            this.queuePcmChunk(rawPcm, ctx);
          }
        }
      }
    }
  }

  private queuePcmChunk(pcmData: ArrayBuffer, ctx: AudioContext) {
    const int16Array = new Int16Array(pcmData);
    const float32Array = new Float32Array(int16Array.length);

    // Convert 16-bit PCM integer samples to -1.0 .. 1.0 float samples
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.copyToChannel(float32Array, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(this.nextStartTime, ctx.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
```

#### 2. Convert PCM Base64 to Playable WAV Blob for `<audio>` Elements

```typescript
export function pcmToWavBlob(pcmBytes: Uint8Array, sampleRate = 24000): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.byteLength;

  // RIFF identifier
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);             // Subchunk1Size
  view.setUint16(20, 1, true);              // AudioFormat (PCM = 1)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return new Blob([header, pcmBytes], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
```

______________________________________________________________________

## Best Practices & Troubleshooting

- **Audio Session & Permissions**: On iOS and Android, make sure the app's audio
  session/category is configured to allow playback (e.g.,
  `AVAudioSessionCategoryPlayback`).
- **Buffering & Jitter Prevention**: When streaming audio chunks via
  `generateContentStream`, queue buffers sequentially with exact timestamps or
  frame offsets to avoid audio stutter or gaps.
- **Model Compatibility**: TTS features require Gemini models with dedicated
  audio synthesis capabilities (`gemini-3.1-flash-tts-preview`). Do not use
  standard text-only model IDs.
- **App Check Protection**: Generating audio consumes quota. Protect your API
  endpoints by enforcing App Check on every client build.
