# Streaming Responses

## Android (Kotlin)

`generateContentStream` returns a Kotlin `Flow`; collect it from a coroutine
scope and update the UI on each chunk (append `chunk.text ?: ""` to a string if
you also need the complete answer):

```kotlin
lifecycleScope.launch {
    model.generateContentStream("Tell me a long story.")
        .collect { chunk ->
            // `text` is null for non-text chunks, so guard before appending.
            chunk.text?.let { print(it) } // Update UI incrementally
        }
}
```

For a multi-turn chat session, call `chat.sendMessageStream(...)`:

```kotlin
val chat = model.startChat()
lifecycleScope.launch {
    chat.sendMessageStream("Tell me a long story.")
        .collect { chunk ->
            chunk.text?.let { print(it) } // Update UI incrementally
        }
}
```
