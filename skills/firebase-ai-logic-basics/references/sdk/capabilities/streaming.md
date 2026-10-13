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
