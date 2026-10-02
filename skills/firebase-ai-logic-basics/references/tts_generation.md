# Client-Side Text-to-Speech (TTS) Generation with Gemini

Firebase AI Logic enables client-side Text-to-Speech (TTS) generation directly
from your mobile and web applications without maintaining custom backend speech
services. Using specialized Gemini TTS models, apps can synthesize natural,
expressive audio with custom voice personas, multi-speaker dialogues, and
in-flight audio streaming.

______________________________________________________________________

## Supported Models

Always specify a dedicated Gemini TTS model when generating audio:

| Model ID                       | Description                                                  |
| :----------------------------- | :----------------------------------------------------------- |
| `gemini-3.8-flash-tts`         | High-quality, production-ready low-latency speech synthesis. |
| `gemini-3.1-flash-tts-preview` | Preview model for experimental voice synthesis capabilities. |

> [!WARNING] Always verify currently supported model availability in the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt).

______________________________________________________________________

## Core Concepts & Configurations

### 1. Response Modality

To instruct Gemini to synthesize and return audio, configure
`responseModalities` in the generation configuration to include audio:

- **Swift**: `generationConfig = GenerationConfig(responseModalities: [.audio])`
- **Kotlin**:
  `generationConfig { responseModalities = listOf(ResponseModality.AUDIO) }`
- **Web (JS/TS)**: `generationConfig: { responseModalities: ["AUDIO"] }`

### 2. Single-Speaker `SpeechConfig`

Configure voice persona and optional language code (`languageCode`, e.g.
`"en-US"`, `"es-ES"`, `"ja-JP"`) using `SpeechConfig`. Voice names map to Google
prebuilt neural voices (for example: `Puck`, `Charon`, `Kore`, `Fenrir`,
`Aoede`):

- **Swift**:
  ```swift
  let speechConfig = SpeechConfig(
      voiceConfig: VoiceConfig(
          prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: "Puck")
      ),
      languageCode: "en-US"
  )
  ```
- **Kotlin**:
  ```kotlin
  val speechConfig = speechConfig {
      voiceConfig = voiceConfig {
          prebuiltVoiceConfig = prebuiltVoiceConfig {
              voiceName = "Puck"
          }
      }
      languageCode = "en-US"
  }
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

- **Swift**:
  ```swift
  let multiSpeakerConfig = SpeechConfig(
      multiSpeakerVoiceConfig: MultiSpeakerVoiceConfig(
          speakerVoiceConfigs: [
              SpeakerVoiceConfig(
                  speaker: "Host",
                  voiceConfig: VoiceConfig(
                      prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: "Puck")
                  )
              ),
              SpeakerVoiceConfig(
                  speaker: "Guest",
                  voiceConfig: VoiceConfig(
                      prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: "Aoede")
                  )
              )
          ]
      )
  )
  ```
- **Kotlin**:
  ```kotlin
  val multiSpeakerConfig = speechConfig {
      multiSpeakerVoiceConfig = multiSpeakerVoiceConfig {
          speakerVoiceConfigs = listOf(
              speakerVoiceConfig {
                  speaker = "Host"
                  voiceConfig = voiceConfig {
                      prebuiltVoiceConfig = prebuiltVoiceConfig { voiceName = "Puck" }
                  }
              },
              speakerVoiceConfig {
                  speaker = "Guest"
                  voiceConfig = voiceConfig {
                      prebuiltVoiceConfig = prebuiltVoiceConfig { voiceName = "Aoede" }
                  }
              }
          )
      }
  }
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

## Platform Code Snippets

### Swift (iOS)

#### 1. Streaming Playback with `AVAudioEngine`

```swift
import AVFoundation
import FirebaseAILogic

@MainActor
final class SpeechStreamingManager {
    private let audioEngine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    
    // 24 kHz, 16-bit Mono PCM
    private let audioFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: 24000,
        channels: 1,
        interleaved: false
    )!

    init() {
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: audioFormat)
    }

    func streamSpeech(prompt: String) async throws {
        let ai = FirebaseAI.firebaseAI()
        
        let speechConfig = SpeechConfig(
            voiceConfig: VoiceConfig(
                prebuiltVoiceConfig: PrebuiltVoiceConfig(voiceName: "Puck")
            )
        )
        
        let genConfig = GenerationConfig(
            responseModalities: [.audio],
            speechConfig: speechConfig
        )
        
        let model = ai.generativeModel(
            modelName: "gemini-3.8-flash-tts",
            generationConfig: genConfig
        )
        
        if !audioEngine.isRunning {
            try audioEngine.start()
        }
        playerNode.play()

        let stream = model.generateContentStream(prompt)
        for try await chunk in stream {
            for part in chunk.candidates.first?.content.parts ?? [] {
                if let inlineData = part as? InlineDataPart,
                   inlineData.mimeType.contains("audio/pcm") || inlineData.mimeType.contains("audio/l16") {
                    schedulePCMBuffer(data: inlineData.data)
                }
            }
        }
    }

    private func schedulePCMBuffer(data: Data) {
        let frameCount = UInt32(data.count) / audioFormat.streamDescription.pointee.mBytesPerFrame
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: frameCount) else {
            return
        }
        buffer.frameLength = frameCount
        
        data.withUnsafeBytes { rawBufferPointer in
            guard let src = rawBufferPointer.baseAddress else { return }
            if let dest = buffer.int16ChannelData?[0] {
                UnsafeMutableRawPointer(dest).copyMemory(from: src, byteCount: data.count)
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

#### 2. WAV Converter for `AVAudioPlayer`

```swift
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

### Kotlin (Android)

#### Streaming Playback with `AudioTrack`

```kotlin
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.google.firebase.ai.FirebaseAI
import com.google.firebase.ai.type.ResponseModality
import com.google.firebase.ai.type.generationConfig
import com.google.firebase.ai.type.prebuiltVoiceConfig
import com.google.firebase.ai.type.speechConfig
import com.google.firebase.ai.type.voiceConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
            speechConfig = speechConfig {
                voiceConfig = voiceConfig {
                    prebuiltVoiceConfig = prebuiltVoiceConfig {
                        voiceName = "Puck"
                    }
                }
            }
        }

        val generativeModel = FirebaseAI.getInstance().getGenerativeModel(
            modelName = "gemini-3.8-flash-tts",
            generationConfig = config
        )

        audioTrack.play()
        try {
            val responseStream = generativeModel.generateContentStream(prompt)
            responseStream.collect { chunk ->
                chunk.candidates.firstOrNull()?.content?.parts?.forEach { part ->
                    if (part is com.google.firebase.ai.type.InlineDataPart) {
                        val audioBytes = part.data
                        audioTrack.write(audioBytes, 0, audioBytes.size)
                    }
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

#### 2. Convert PCM to WAV for `MediaPlayer`

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

fun playWavAudio(context: Context, wavBytes: ByteArray) {
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
  model: "gemini-3.8-flash-tts",
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
  audio synthesis capabilities (`gemini-3.8-flash-tts` or
  `gemini-3.1-flash-tts-preview`). Do not use standard text-only model IDs.
- **App Check Protection**: Generating audio consumes quota. Protect your API
  endpoints by enforcing App Check on every client build.
