# Streaming Responses

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
