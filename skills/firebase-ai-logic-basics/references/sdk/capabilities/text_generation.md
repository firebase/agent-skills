# Text Generation

Official documentation:
[Generate text using the Gemini API](https://firebase.google.com/docs/ai-logic/generate-text.md.txt)

Text generation is the most basic Firebase AI Logic capability: send a text-only
prompt to a Gemini model with `generateContent` and read the generated text from
the response. Reach for it whenever an app needs a single, complete answer
(summaries, rewrites, classification, Q&A). For incremental display see the
Streaming capability; for multi-turn conversations see the Chat capability.

Generation config (`GenerationConfig`) and safety settings apply to every
capability, not just text generation, so they are covered once in the
[Model Configuration & Safety Settings](../../../SKILL.md#model-configuration--safety-settings)
section of `SKILL.md`. Do **not** set unsupported sampling parameters
(`temperature`, `topP`, `topK`, `candidateCount`, `presencePenalty`,
`frequencyPenalty`); they cause unexpected behavior and, in some cases, HTTP 400
errors.

## Android (Kotlin)

Call `generativeModel` and use the suspend function `generateContent` from a
coroutine scope (such as `lifecycleScope`):

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend

// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>"
)

// Generate content
lifecycleScope.launch {
    try {
        val response = model.generateContent("Write a story about a magic backpack.")
        Log.d(TAG, "Response: ${response.text}")
    } catch (e: Exception) {
        Log.e(TAG, "Error generating content", e)
    }
}
```

## iOS (Swift)

Call `generativeModel(modelName:)` and `await generateContent(prompt)`.
`response.text` is optional, so always provide a fallback. In SwiftUI, run the
call from a `Task` inside an `@Observable` view model (see the iOS setup guide
for that pattern).

```swift
import FirebaseAILogic

// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>"
)

// Provide a prompt that contains text
let prompt = "Write a story about a magic backpack."
// To generate text output, call generateContent with the text input
do {
  let response = try await model.generateContent(prompt)
  print(response.text ?? "No response")
} catch {
  print("Error generating content: \(error.localizedDescription)")
}
```

## Flutter (Dart)

Call `generativeModel` and pass prompts as a list of `Content`. `response.text`
is nullable, so provide a fallback.

```dart
import 'package:firebase_ai/firebase_ai.dart';

Future<String> generateText(String prompt) async {
  final googleAI = FirebaseAI.googleAI();

  // [AGENT] Replace '<latest_supported_model>' with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
  final model = googleAI.generativeModel(
    model: '<latest_supported_model>',
  );

  try {
    final response = await model.generateContent([Content.text(prompt)]);
    return response.text ?? '';
  } on FirebaseAIException catch (e) {
    // Blocked or stopped responses throw FirebaseAIException when reading .text
    rethrow;
  }
}
```

## Web (JavaScript)

Call `getGenerativeModel(ai, { model })` and pass the prompt to
`generateContent(prompt)`. `response.text()` returns the generated text:

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

// Initialize the AI Logic service (defaults to Gemini Developer API)
const ai = getAI(app, { backend: new GoogleAIBackend() });

// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
const model = getGenerativeModel(ai, { model: "<latest_supported_model>" });

async function generateText(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    // Blocked responses throw AIError when calling .text()
    throw err;
  }
}
```

## Troubleshooting

- **HTTP 400 or unexpected behavior from `GenerationConfig`.** Remove any
  unsupported sampling parameters (`temperature`, `topP`, `topK`,
  `candidateCount`, `presencePenalty`, `frequencyPenalty`); do not set them.
- **Blocked or truncated response (thrown exception).** Android
  (`PromptBlockedException` / `ResponseStoppedException`) and iOS
  (`GenerateContentError.promptBlocked` / `.responseStoppedEarly`) throw from
  `generateContent` itself, for any finish reason other than `STOP` (including
  `MAX_TOKENS`). Flutter (`FirebaseAIException`) and Web (`AIError`) throw when
  you read `.text` / `.text()` on a blocked response. A `??` / `?:` fallback on
  `text` therefore never handles a block; wrap the call in `try` / `catch` (`do`
  / `catch` in Swift). Inspect `promptFeedback.blockReason` on the response and
  `finishReason` on the first candidate, then rewrite the prompt.
