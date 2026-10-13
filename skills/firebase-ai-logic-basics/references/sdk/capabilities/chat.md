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
