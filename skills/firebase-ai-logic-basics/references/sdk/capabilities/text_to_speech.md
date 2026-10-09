# Client-Side Text-to-Speech (TTS) Generation with Gemini

> [!WARNING] **Preview:** Using the Firebase AI Logic SDKs for text-to-speech
> (TTS) generation is in Preview and may change in backwards-incompatible ways.

Firebase AI Logic enables client-side Text-to-Speech (TTS) generation directly
from your Android, iOS, Flutter, and Web applications without maintaining custom
backend speech services. Using Gemini TTS models, apps can synthesize
controllable speech from exact text transcripts with single- or two-speaker
voices, natural-language style guidance, inline audio tags, and low-latency
streaming.

______________________________________________________________________

## Supported Models

Always specify a dedicated Gemini TTS model when generating audio:

| Model ID                       | Description                                                                                                   |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `gemini-3.1-flash-tts-preview` | Low-latency speech synthesis (preview); supports single-speaker, 2-speaker dialogue, streaming, and `[tags]`. |

> [!NOTE] Firebase AI Logic also supports Gemini 2.x TTS models, but streaming
> (`generateContentStream`), inline audio tags (`[whispers]`, `[laughs]`), and
> expanded auto-detected languages are only supported on Gemini 3.x TTS models
> (`gemini-3.1-flash-tts-preview`). Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for newly released TTS models.

> [!IMPORTANT] **Model-specific API differences
> (`gemini-3.1-flash-tts-preview`):**
>
> - **Raw PCM output on both unary and streaming calls:** Both `generateContent`
>   and `generateContentStream` return **headerless raw 16-bit linear PCM**
>   (`audio/pcm`, 24 kHz, mono, little-endian). Do **not** assume unary
>   `generateContent` responses include a WAV header — always play via a raw PCM
>   API (`AudioTrack`, `AVAudioEngine`, Web Audio `AudioContext`) or prepend a
>   44-byte WAV (RIFF) header before passing bytes to `MediaPlayer`,
>   `AVAudioPlayer`, `<audio>`, or file-based players.
> - **Prompt-based style & square-bracket tags:** Pass style guidance in the
>   text prompt (using `[Audio Profile]` / `[Director's Notes]` or a
>   natural-language prefix like `"Say cheerfully: ..."`), speaker turns as
>   `SpeakerName: ...` prefixes in the prompt text, and inline vocal tags in
>   **square brackets** (`[whispers]`, `[laughs]`, `[sighs]`). Do **not** use
>   `speech_metadata` part fields or angle-bracket tags (`<sigh>`).
> - **Omit text-sampling parameters:** Do not pass `temperature`, `topP`,
>   `topK`, `candidateCount`, or `systemInstruction` on TTS requests.

______________________________________________________________________

## Configuration

### 1. Response Modality

Configure `responseModalities` in `GenerationConfig` to request `AUDIO` output:

- **Android (Kotlin)**:
  `generationConfig { responseModalities = listOf(ResponseModality.AUDIO) }`
- **iOS (Swift)**:
  `GenerationConfig(responseModalities: [.audio], speechConfig: ...)`
- **Flutter (Dart)**:
  `GenerationConfig(responseModalities: [ResponseModalities.audio], speechConfig: ...)`
- **Web (JS/TS)**:
  `generationConfig: { responseModalities: [ResponseModality.AUDIO], speechConfig: ... }`

### 2. Single-Speaker `SpeechConfig`

Configure a voice name from the 30 supported multilingual HD voices (for
example: `Kore`, `Puck`, `Charon`, `Fenrir`, `Aoede`) and an optional BCP-47
`languageCode` (such as `"en-US"`, `"es-ES"`, `"ja-JP"`, `"hi-IN"`). If you omit
`languageCode`, the model automatically detects the language from the prompt.

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
- **Flutter (Dart)**:
  ```dart
  final config = GenerationConfig(
    responseModalities: [ResponseModalities.audio],
    speechConfig: SpeechConfig(voiceName: 'Kore', languageCode: 'en-US'),
  );
  ```
- **Web (JavaScript)**:
  ```javascript
  const generationConfig = {
    responseModalities: [ResponseModality.AUDIO],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      languageCode: "en-US",
    },
  };
  ```

### 3. Multi-Speaker `MultiSpeakerVoiceConfig` (Exactly 2 Speakers)

For dialogues or conversations, map speaker names (used as `Speaker: ...`
prefixes in your prompt) to voices using `MultiSpeakerVoiceConfig`:

- **Constraint:** Multi-speaker configuration supports **exactly 2 speakers**.

- **Multilingual dialogues:** You can mix languages in a single multi-speaker
  request (for example, one speaker in Japanese and another in Portuguese). For
  mixed-language prompts, **do not** set `languageCode` in `SpeechConfig` so the
  model automatically detects and switches languages on each speaker's turn.

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

- **Flutter (Dart)** (use the `SpeechConfig.multiSpeaker` named constructor):

  ```dart
  final multiSpeechConfig = SpeechConfig.multiSpeaker(
    multiSpeakerVoiceConfig: MultiSpeakerVoiceConfig(
      speakerVoiceConfigs: [
        SpeakerVoiceConfig(speaker: 'Joe', voiceName: 'Puck'),
        SpeakerVoiceConfig(speaker: 'Jane', voiceName: 'Kore'),
      ],
    ),
    languageCode: 'en-US',
  );
  ```

- **Web (JavaScript)**:

  ```javascript
  const generationConfig = {
    responseModalities: [ResponseModality.AUDIO],
    speechConfig: {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [
          {
            speaker: "Joe",
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          {
            speaker: "Jane",
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        ],
      },
      languageCode: "en-US",
    },
  };
  ```

______________________________________________________________________

## Control Speech Output with Prompts

### 1. Prompt Structure

For best results (and to prevent the speech classifier from rejecting vague
prompts or reading instructions aloud), structure prompts with these components:

- **`Audio Profile`**: Speaker persona, core identity, and archetype (e.g.,
  `A warm, professional narrator`).
- **`Scene`**: Environment and emotional vibe (e.g., `In a quiet library` or
  `A lively sports broadcast`).
- **`Director's Notes`**: Emotion, pace, style, and accent (e.g.,
  `Speak fast, with high energy and excitement`).
- **`Sample Context`**: Starting context for delivery (e.g.,
  `The game just ended with a last-second touchdown`).
- **Transcript**: The exact text to be spoken.

```text
[Audio Profile: A young, energetic voice]
[Scene: A lively sports broadcast]
[Director's Notes: Speak fast, with high energy and excitement]
[Sample Context: The game just ended with a last-second touchdown]
Welcome back fans! What an incredible game we're witnessing today!
```

### 2. Audio Tags (`gemini-3.1-flash-tts-preview`)

Insert square-bracket formatting tags directly in the text prompt to guide vocal
performance:

- `[whispers]` — Speak in a whisper
- `[laughs]` / `[giggles]` — Add laughter or giggles
- `[sighs]` / `[gasp]` — Add a sigh or gasp
- `[shouting]` — Shout
- `[excited]` / `[serious]` — Shift emotional tone
- `[sighs whispers]` — Combine multiple tags in one bracket

Rules when using audio tags:

- **No fixed list:** Experiment with descriptive expressions such as `[bored]`
  or `[sarcastically]`.
- **Always use English tags:** Even when the spoken transcript is in another
  language, write the bracketed audio tags in English.

```text
I have a secret to tell you. [whispers] I found the hidden treasure. [laughs] I can't believe it!
```

______________________________________________________________________

## Audio Decoding and Playback

### Format Specifications

`gemini-3.1-flash-tts-preview` returns **raw PCM audio data** for **both** unary
(`generateContent`) and streaming (`generateContentStream`) calls:

- **Encoding**: 16-bit signed linear PCM, little-endian (`audio/pcm` or
  `audio/l16`)
- **Sample Rate**: 24,000 Hz (24 kHz)
- **Channels**: 1 channel (mono)
- **Container Header**: **None** (raw headerless PCM bytes)

Because the response bytes have no container header (like WAV or MP3), standard
media players (`AVAudioPlayer`, `MediaPlayer`, `<audio>`) cannot play the raw
bytes directly. Choose one of two playback options:

1. **Option 1 — Low-level raw PCM playback (recommended for streaming):** Pass
   raw 24 kHz 16-bit mono PCM buffers directly to `AudioTrack` (Android),
   `AVAudioEngine` + `AVAudioPlayerNode` (iOS), or the Web Audio API
   `AudioContext` (Web).
1. **Option 2 — Prepend a 44-byte WAV (RIFF) header (unary or buffered):**
   Prepend a standard 44-byte WAV header to the raw PCM bytes so standard
   players (`MediaPlayer`, `AVAudioPlayer`, `<audio>`, or Flutter audio plugins)
   can play the buffer or temporary `.wav` file directly.

#### Standard 44-Byte WAV (RIFF) Header Layout

```text
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
import com.google.firebase.ai.type.InlineDataPart
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
    val part = response.candidates.firstOrNull()?.content?.parts?.firstOrNull()
    if (part is InlineDataPart) {
        return part.inlineData // Raw PCM bytes (24kHz, 1 channel, 16-bit)
    }
    return null
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
    val part = response.candidates.firstOrNull()?.content?.parts?.firstOrNull()
    return (part as? InlineDataPart)?.inlineData
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
import com.google.firebase.ai.type.InlineDataPart
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
                val part = chunk.candidates.firstOrNull()?.content?.parts?.firstOrNull()
                if (part is InlineDataPart) {
                    val pcmChunk = part.inlineData // Raw PCM bytes (24kHz, 1 channel, 16-bit)
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
    for part in response.inlineDataParts {
        let pcmData = part.data // Raw PCM audio bytes (24kHz, 1 channel, 16-bit)
        playRawPcm(data: pcmData)
    }
}

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
    for part in response.inlineDataParts {
        playRawPcm(data: part.data)
    }
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
            let int16Buffer = rawBufferPointer.bindMemory(to: Int16.self)
            for i in 0..<sampleCount {
                let sample = Int16(littleEndian: int16Buffer[i])
                floatChannel[i] = Float(sample) / 32768.0
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

var audioPlayer: AVAudioPlayer?

func playRawPcm(data: Data) {
    let wavData = addWavHeader(to: data)
    do {
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

## Flutter (Dart)

### 1. Single-Speaker Generation (`generateContent`)

```dart
import 'dart:typed_data';
import 'package:firebase_ai/firebase_ai.dart';

Future<Uint8List?> generateSpeech(String prompt) async {
  final config = GenerationConfig(
    responseModalities: [ResponseModalities.audio],
    speechConfig: SpeechConfig(voiceName: 'Kore', languageCode: 'en-US'),
  );

  final model = FirebaseAI.googleAI().generativeModel(
    model: 'gemini-3.1-flash-tts-preview',
    generationConfig: config,
  );

  final response = await model.generateContent([Content.text(prompt)]);

  for (final part in response.inlineDataParts) {
    if (part.mimeType.startsWith('audio/')) {
      final Uint8List pcmData = part.bytes; // Raw PCM bytes (24kHz, 1 channel, 16-bit)
      return addWavHeader(pcmData);
    }
  }
  return null;
}
```

### 2. Multi-Speaker Dialogue

```dart
final multiSpeechConfig = SpeechConfig.multiSpeaker(
  multiSpeakerVoiceConfig: MultiSpeakerVoiceConfig(
    speakerVoiceConfigs: [
      SpeakerVoiceConfig(speaker: 'Joe', voiceName: 'Puck'),
      SpeakerVoiceConfig(speaker: 'Jane', voiceName: 'Kore'),
    ],
  ),
  languageCode: 'en-US',
);

final model = FirebaseAI.googleAI().generativeModel(
  model: 'gemini-3.1-flash-tts-preview',
  generationConfig: GenerationConfig(
    responseModalities: [ResponseModalities.audio],
    speechConfig: multiSpeechConfig,
  ),
);

const prompt = '''
Joe: How's it going today Jane?
Jane: [excited] Not too bad, how about you?
''';

final response = await model.generateContent([Content.text(prompt)]);
```

### 3. Streaming with `generateContentStream`

```dart
import 'dart:typed_data';
import 'package:firebase_ai/firebase_ai.dart';

Future<Uint8List> streamSpeech(String prompt) async {
  final model = FirebaseAI.googleAI().generativeModel(
    model: 'gemini-3.1-flash-tts-preview',
    generationConfig: GenerationConfig(
      responseModalities: [ResponseModalities.audio],
      speechConfig: SpeechConfig(voiceName: 'Kore'),
    ),
  );

  final pcm = BytesBuilder(copy: false);
  final responseStream = model.generateContentStream([Content.text(prompt)]);

  await for (final chunk in responseStream) {
    for (final part in chunk.inlineDataParts) {
      if (part.mimeType.startsWith('audio/')) {
        final Uint8List pcmChunk = part.bytes; // Raw PCM bytes (24kHz, 1 channel, 16-bit)
        // Low-latency path: feed `pcmChunk` directly to a raw-PCM audio stream.
        pcm.add(pcmChunk);
      }
    }
  }

  // Buffered path: prepend a 44-byte WAV header for standard audio players.
  return addWavHeader(pcm.takeBytes());
}
```

### 4. Prepend WAV Header in Dart

```dart
import 'dart:typed_data';

Uint8List addWavHeader(
  Uint8List pcmBytes, {
  int sampleRate = 24000,
  int channels = 1,
  int bitDepth = 16,
}) {
  final byteRate = sampleRate * channels * bitDepth ~/ 8;
  final blockAlign = channels * bitDepth ~/ 8;

  final header = ByteData(44)
    ..setUint32(4, 36 + pcmBytes.length, Endian.little) // ChunkSize
    ..setUint32(16, 16, Endian.little) // Subchunk1Size for PCM
    ..setUint16(20, 1, Endian.little) // AudioFormat 1 = PCM
    ..setUint16(22, channels, Endian.little)
    ..setUint32(24, sampleRate, Endian.little)
    ..setUint32(28, byteRate, Endian.little)
    ..setUint16(32, blockAlign, Endian.little)
    ..setUint16(34, bitDepth, Endian.little)
    ..setUint32(40, pcmBytes.length, Endian.little); // Subchunk2Size

  final headerBytes = header.buffer.asUint8List()
    ..setAll(0, 'RIFF'.codeUnits)
    ..setAll(8, 'WAVE'.codeUnits)
    ..setAll(12, 'fmt '.codeUnits)
    ..setAll(36, 'data'.codeUnits);

  return (BytesBuilder(copy: false)
        ..add(headerBytes)
        ..add(pcmBytes))
      .takeBytes();
}
```

______________________________________________________________________

## Web (JavaScript)

### 1. Single-Speaker & Multi-Speaker Generation (`generateContent`)

```javascript
import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
} from "firebase/ai";

const firebaseApp = initializeApp(firebaseConfig);
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const model = getGenerativeModel(ai, {
  model: "gemini-3.1-flash-tts-preview",
  generationConfig: {
    responseModalities: [ResponseModality.AUDIO],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      languageCode: "en-US",
    },
  },
});

const result = await model.generateContent(
  "Say cheerfully: Have a wonderful day!"
);
const inlineDataParts = result.response.inlineDataParts();
if (inlineDataParts?.[0]) {
  const pcmBase64 = inlineDataParts[0].inlineData.data; // Raw PCM bytes (24kHz, 1 channel, 16-bit)
  const pcmBuffer = Uint8Array.from(atob(pcmBase64), (c) =>
    c.charCodeAt(0)
  ).buffer;
  playAudio(pcmBuffer);
}
```

### 2. Streaming Playback with Web Audio API (`generateContentStream`)

```typescript
import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
} from "firebase/ai";

const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new GoogleAIBackend() });

const model = getGenerativeModel(ai, {
  model: "gemini-3.1-flash-tts-preview",
  generationConfig: {
    responseModalities: [ResponseModality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Kore",
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
        throw new Error(
          "AudioContext is only available in browser environments."
        );
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
      const inlineDataParts = chunk.inlineDataParts();
      if (inlineDataParts?.[0]) {
        const rawPcm = this.base64ToArrayBuffer(
          inlineDataParts[0].inlineData.data
        );
        this.queuePcmChunk(rawPcm, ctx);
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

### 3. Convert Raw PCM to Playable WAV `Blob` for `<audio>` Elements

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
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM = 1)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return new Blob([header, new Uint8Array(pcmBytes)], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
```

______________________________________________________________________

## Constraints & Troubleshooting (`gemini-3.1-flash-tts-preview`)

- **Occasional Text Token Returns (`500` Error)**:
  `gemini-3.1-flash-tts-preview` occasionally returns text tokens instead of
  audio tokens on a small percentage of requests, causing the call to fail with
  a `500` error. Always implement retry logic around TTS generation calls.
- **Classifier False Rejections (`PROHIBITED_CONTENT` or Spoken Instructions)**:
  Vague prompts can trigger the speech synthesis safety classifier
  (`PROHIBITED_CONTENT`) or cause the model to read style instructions aloud.
  Use a structured prompt preamble (`[Audio Profile: ...]`,
  `[Director's Notes: ...]`) before the transcript.
- **Voice Inconsistency**: Output may deviate from the selected speaker voice if
  the prompt's tone or persona contradicts the voice's profile. Keep prompt
  directions aligned with the chosen voice.
- **Longer Outputs Drift**: Speech quality and consistency can degrade on
  outputs longer than a few minutes. Split long transcripts into smaller chunks.
- **Audio Session & Permissions**: On iOS and Android, configure the app's audio
  session/category for playback (e.g., `AVAudioSession.Category.playback`).
- **Buffering & Jitter Prevention**: When streaming audio chunks via
  `generateContentStream`, schedule buffers sequentially with exact frame or
  timestamp offsets to avoid gaps.
- **App Check Protection**: Generating audio consumes quota; enforce App Check
  with `useLimitedUseAppCheckTokens` enabled in production.

Last verified against
https://firebase.google.com/docs/ai-logic/generate-speech.md.txt on 2026-10-09.
