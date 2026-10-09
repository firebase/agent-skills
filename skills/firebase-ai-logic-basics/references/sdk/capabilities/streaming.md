# Streaming Responses

Streaming returns the model's output as a sequence of partial responses instead
of one complete response, so the UI can start rendering text while the model is
still generating (the familiar "typing" effect). Reach for it whenever a user is
waiting on screen for a long answer; perceived latency drops sharply even though
the total generation time is the same. Call `generateContentStream` instead of
`generateContent` — the prompt, model, generation config and safety settings are
otherwise identical to plain text generation.

## Configuration

Each item yielded by the stream is a partial `GenerateContentResponse` whose
`text` holds only the newly generated tokens; append the chunks in order to
build the full answer. A chunk's `text` is optional on Android, iOS and Flutter,
so guard against `null` before appending. `candidateCount` is not applicable
when streaming.

Streaming also works for multimodal input: pass the same file parts (image,
audio, video, PDF) you would give `generateContent` to `generateContentStream`.
Chat sessions stream the same way through `sendMessageStream` on the chat
object, which keeps history exactly like `sendMessage`; see the Chat capability
for the full chat examples.

## Android (Kotlin)

`generateContentStream` returns a Kotlin `Flow`; collect it from a coroutine
scope and update the UI on each chunk (append `chunk.text ?: ""` to a string if
you also need the complete answer). For a chat session call
`chat.sendMessageStream("...")` and collect the same way.

```kotlin
lifecycleScope.launch {
    model.generateContentStream("Tell me a long story.")
        .collect { chunk ->
            print(chunk.text) // Update UI incrementally
        }
}
```

## iOS (Swift)

`generateContentStream` returns an `AsyncThrowingStream`; iterate it with
`for try await`. The call itself is marked `throws` but is not `async`, so the
`try` sits before `model.generateContentStream` and the `await` on the loop. For
a chat session call `chat.sendMessageStream("...")` and iterate the same way.

```swift
import FirebaseAILogic

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(modelName: "<latest_supported_model>")

// Provide a prompt that contains text
let prompt = "Write a story about a magic backpack."
// To stream generated text output, call generateContentStream with the text input
let contentStream = try model.generateContentStream(prompt)
for try await chunk in contentStream {
  if let text = chunk.text {
    print(text) // Update UI incrementally
  }
}
```

## Flutter (Dart)

`generateContentStream` returns a Dart `Stream<GenerateContentResponse>`;
consume it with `await for`. For a chat session call
`chat.sendMessageStream(Content.text('...'))` and consume it the same way.

```dart
import 'package:firebase_ai/firebase_ai.dart';

// [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(model: '<latest_supported_model>');

// Provide a prompt that contains text
final prompt = [Content.text('Write a story about a magic backpack.')];
// To stream generated text output, call generateContentStream with the text input
final response = model.generateContentStream(prompt);
await for (final chunk in response) {
  print(chunk.text); // Update UI incrementally
}
```

## Web (JavaScript)

For real-time UI updates (like a typing effect), `generateContentStream`
resolves to a result whose `stream` is an async iterable of chunks; read each
chunk's `text()`. After the loop, `await result.response` gives the aggregated
final response if you also need the complete text. For a chat session call
`chat.sendMessageStream(msg)` and iterate `result.stream` the same way.

```javascript
async function streamResponse(prompt) {
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    console.log("Stream chunk:", chunkText);
    // Update UI here
  }
}
```

## Troubleshooting

- **Nothing renders until the end.** Update the UI inside the loop body (per
  chunk), not after the loop. On iOS run the loop where it may touch views (for
  example inside an `@MainActor` view model); on Android collect the `Flow` from
  a UI-bound scope such as `lifecycleScope` or `viewModelScope`.
- **`null` appended to the text.** `chunk.text` is nullable on Kotlin, Swift and
  Dart; use `chunk.text ?: ""` / `if let text = chunk.text` / `?? ''` before
  concatenating.
- **Request fails after adding `candidateCount`.** `candidateCount` is not
  applicable to `generateContentStream`, and `gemini-3.7-flash` and later reject
  it with HTTP 400 regardless; remove it from the `GenerationConfig`.

See the official text generation guide (section "Stream the response"):
https://firebase.google.com/docs/ai-logic/generate-text

Last verified against
https://firebase.google.com/docs/ai-logic/generate-text.md.txt (section "Stream
the response"), https://firebase.google.com/docs/ai-logic/chat.md.txt, and the
Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk,
flutterfire; `main` branches) on 2026-10-08.
