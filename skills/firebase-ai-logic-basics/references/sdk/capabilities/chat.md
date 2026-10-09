# Chat (Multi-turn Conversations)

Use a chat session when the user and the model exchange more than one message
and later turns depend on earlier ones. The SDK manages the conversation state
for you: `startChat()` creates a session (optionally seeded with prior history)
and every `sendMessage()` call appends both the user message and the model's
reply to that history, so unlike `generateContent()` you never store or resend
the transcript yourself. Chat is also the recommended way to run tools such as
function calling, which need a back-and-forth between the model and your app.

## Configuration

- **Roles.** Content in a conversation has one of two roles. `user` provides the
  prompts and is the default for `sendMessage()`; the call throws if a different
  role is passed. `model` provides the responses and is only used when you seed
  `startChat()` with existing `history`.
- **History is automatic.** After `startChat()`, each `sendMessage()` adds the
  user message and the model response to the session, so a follow-up such as
  "How many paws are in my house?" can refer back to an earlier "I have two
  dogs". Keep one chat object per conversation.
- **Seeding history.** Pass alternating `user` / `model` content to
  `startChat()` to resume a stored conversation or to give the model examples.
  To steer overall behaviour instead, prefer system instructions; see
  https://firebase.google.com/docs/ai-logic/system-instructions.md.txt.
- **Streaming replies.** Call `sendMessageStream()` on the chat instead of
  `sendMessage()` to receive the reply chunk by chunk; see the Streaming
  capability for full examples.
- **Multimodal turns.** `sendMessage()` accepts the same parts as
  `generateContent()` (text, images, audio, PDF). With a Gemini image model and
  `IMAGE` in `responseModalities`, chat lets you iteratively edit a generated
  image across turns; see the "Iterate and edit images" section of
  https://firebase.google.com/docs/ai-logic/chat.md.txt.

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

## Flutter (Dart)

Seed the session with `Content.text` (user role) and `Content.model` entries,
then send new user messages:

```dart
import 'package:firebase_ai/firebase_ai.dart';

// [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(model: '<latest_supported_model>');

final chat = model.startChat(history: [
  Content.text('Hello, I am a user.'),
  Content.model([TextPart('Hello! How can I help you today?')]),
]);

final response = await chat.sendMessage(Content.text('What is CBT?'));
print(response.text);
```

## Web (JavaScript)

Maintain history automatically using `startChat`.

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const ai = getAI(app, { backend: new GoogleAIBackend() });
// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
const model = getGenerativeModel(ai, { model: "<latest_supported_model>" });

const chat = model.startChat({
  history: [
    {
      role: "user",
      parts: [{ type: "text", text: "Hello, I am a developer." }],
    },
    {
      role: "model",
      parts: [{ type: "text", text: "Great to meet you. How can I help with code?" }],
    },
  ],
});

async function sendMessage(msg) {
  const result = await chat.sendMessage(msg);
  return result.response.text();
}
```

## Troubleshooting

- **Error when sending a message with a custom role.** `sendMessage()` only
  accepts user turns (use `content { ... }` on Android, string/parts on iOS and
  Web, or `Content.text(...)` / `Content.multi(...)` on Flutter, which all set
  the `user` role automatically). Passing the `model` role to `sendMessage()`
  throws on Android or fails with HTTP 400; `model` is valid only inside the
  `history` passed to `startChat()`.
- **The model "forgets" earlier turns.** Each `startChat()` call creates a new
  session that contains only the `history` you pass in. Keep a single chat
  object for the lifetime of the conversation and reuse it for every
  `sendMessage()`; do not create one per message.

See the official chat guide: https://firebase.google.com/docs/ai-logic/chat

Last verified against https://firebase.google.com/docs/ai-logic/chat.md.txt and
the Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk,
firebase-js-sdk, flutterfire; `main` branches) on 2026-10-08.
