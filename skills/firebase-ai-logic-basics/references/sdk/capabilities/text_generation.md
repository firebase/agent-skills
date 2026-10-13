# Text Generation

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

  final response = await model.generateContent([Content.text(prompt)]);
  return response.text ?? 'No response';
}
```

## Web (JavaScript)

Call `getGenerativeModel(ai, { model })` and pass the prompt to
`generateContent(prompt)`. `response.text()` returns the generated text:

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

// Initialize the AI Logic service (defaults to Gemini Developer API)
const ai = getAI(app, { backend: new GoogleAIBackend() });

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
const model = getGenerativeModel(ai, { model: "<latest_supported_model>" });

async function generateText(prompt) {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}
```

### Optional: Custom Generation Config & Safety Settings

Pass optional plain objects for `generationConfig` and `safetySettings` in the
options of `getGenerativeModel`; `HarmCategory` and `HarmBlockThreshold` are
exported from `firebase/ai`.

```javascript
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  HarmBlockThreshold,
  HarmCategory,
} from "firebase/ai";

const ai = getAI(app, { backend: new GoogleAIBackend() });

// Set optional parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
const generationConfig = {
  maxOutputTokens: 200,
  stopSequences: ["red"],
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Specify optional config and safety settings when creating the GenerativeModel instance
const configuredModel = getGenerativeModel(ai, {
  model: "<latest_supported_model>",
  generationConfig,
  safetySettings,
});
```
