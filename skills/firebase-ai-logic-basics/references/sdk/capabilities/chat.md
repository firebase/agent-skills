# Chat (Multi-turn Conversations)

## Android (Kotlin)

Maintain chat history automatically. The SDK methods are `suspend` functions, so
call them from a coroutine scope such as `lifecycleScope`:

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.content

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel("<latest_supported_model>")

val chat = model.startChat(
    history = listOf(
        content("user") { text("Hello, I am a software engineer.") },
        content("model") { text("Hello! How can I help you today?") }
    )
)

lifecycleScope.launch {
    val response = chat.sendMessage("What should I learn next?")
    Log.d(TAG, response.text ?: "")
}
```

## iOS (Swift)

Chat sessions persist state across multiple interactions, which is essential for
ongoing conversations or when using tools like function calling.

```swift
import FirebaseAILogic

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(modelName: "<latest_supported_model>")

let chat = model.startChat()

Task {
    do {
        let response1 = try await chat.sendMessage("Hello! I have two dogs in my house.")
        print(response1.text ?? "")

        let response2 = try await chat.sendMessage("How many paws are in my house?")
        print(response2.text ?? "")
    } catch {
        print("Error in chat: \(error)")
    }
}
```

To resume an existing conversation, seed the session with `ModelContent` history
(roles `user` and `model`):

```swift
let history = [
    ModelContent(role: "user", parts: "Hello, I have 2 dogs in my house."),
    ModelContent(role: "model", parts: "Great to meet you. What would you like to know?"),
]
let chat = model.startChat(history: history)
```
