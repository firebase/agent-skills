# Text Generation

Text generation is the most basic Firebase AI Logic capability: send a text-only
prompt to a Gemini model with `generateContent` and read the generated text from
the response. Reach for it whenever an app needs a single, complete answer
(summaries, rewrites, classification, Q&A). For incremental display see the
Streaming capability; for multi-turn conversations see the Chat capability. The
Gemini Developer API provider used below does not usually require the Blaze
billing plan.

Two model-level options travel with every `generateContent` call and are set
once when the `GenerativeModel` instance is created: a **generation config**
(how much and how the model generates) and **safety settings** (what the model
is allowed to generate). Both are optional.

## Configuration

### Generation config

A `GenerationConfig` is passed when creating the `GenerativeModel` and applies
to every request from that instance (Web and Flutter also accept per-request
`generationConfig` / `safetySettings` overrides). Full parameter descriptions:
https://firebase.google.com/docs/ai-logic/model-parameters.md.txt

| Parameter          | What it controls                                                                                                                                | Status on general-use Gemini 3.x and later models                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `maxOutputTokens`  | Maximum number of tokens that can be generated in the response.                                                                                 | Supported                                                        |
| `stopSequences`    | Strings that make the model stop generating when one of them appears in the response.                                                           | Supported (not applicable to image or TTS models)                |
| `temperature`      | Degree of randomness. Lower is more deterministic, higher is more diverse or creative.                                                          | Ignored                                                          |
| `topP`             | Nucleus sampling: tokens are picked from most to least probable until their probabilities sum to `topP`.                                        | Ignored                                                          |
| `topK`             | Limits sampling to the `k` most probable tokens for each step.                                                                                  | Ignored                                                          |
| `candidateCount`   | Number of response variations to return (1–8). `generateContent` only, not streaming. You are charged for the output tokens of every candidate. | Request **fails with HTTP 400** starting with `gemini-3.7-flash` |
| `presencePenalty`  | Penalizes new tokens based on whether they have already appeared in the text so far.                                                            | Request **fails with HTTP 400** starting with `gemini-3.7-flash` |
| `frequencyPenalty` | Penalizes new tokens based on their existing frequency in the text so far.                                                                      | Request **fails with HTTP 400** starting with `gemini-3.7-flash` |

> [!WARNING] **Gemini 3.x and later drop the sampling parameters.** For the
> latest general-use Gemini 4.x and 3.x models, `temperature`, `topK` and `topP`
> are ignored, and `candidateCount`, `frequencyPenalty` and `presencePenalty`
> are unsupported; newer models (currently `gemini-3.7-flash`,
> `gemini-3.8-flash` and `gemini-4-argon`) reject them with HTTP 400. Prefer
> `maxOutputTokens` and `stopSequences` in new code, and remove the other
> parameters when upgrading an existing app.

`GenerationConfig` also carries capability-specific fields (`responseMimeType`
and `responseSchema` for structured output, `responseModalities`,
`thinkingConfig`, `speechConfig`, `imageConfig`); those are covered by the
capability that needs them (for example structured output, image generation and
text-to-speech) rather than here.

### Safety settings

Safety settings adjust the likelihood of getting responses that may be
considered harmful. The default threshold depends on the model: for current
models (Gemini 3.x and later on the Gemini Developer API and Agent Platform
Gemini API) the filters are **off** by default, so set an explicit threshold if
you want the model to block content. You configure one `SafetySetting` per harm
category when creating the `GenerativeModel`; each pairs a category with a block
threshold. Gemini Live API models do **not** support safety settings. Details:
https://firebase.google.com/docs/ai-logic/safety-settings.md.txt

Harm categories, with the enum name used by each SDK:

| Category          | Kotlin              | Swift               | Dart               | Web                               |
| ----------------- | ------------------- | ------------------- | ------------------ | --------------------------------- |
| Harassment        | `HARASSMENT`        | `.harassment`       | `harassment`       | `HARM_CATEGORY_HARASSMENT`        |
| Hate speech       | `HATE_SPEECH`       | `.hateSpeech`       | `hateSpeech`       | `HARM_CATEGORY_HATE_SPEECH`       |
| Sexually explicit | `SEXUALLY_EXPLICIT` | `.sexuallyExplicit` | `sexuallyExplicit` | `HARM_CATEGORY_SEXUALLY_EXPLICIT` |
| Dangerous content | `DANGEROUS_CONTENT` | `.dangerousContent` | `dangerousContent` | `HARM_CATEGORY_DANGEROUS_CONTENT` |

Block thresholds, from strictest to most permissive:

| Threshold                       | Kotlin             | Swift                  | Dart     | Web                      |
| ------------------------------- | ------------------ | ---------------------- | -------- | ------------------------ |
| Block low probability and above | `LOW_AND_ABOVE`    | `.blockLowAndAbove`    | `low`    | `BLOCK_LOW_AND_ABOVE`    |
| Block medium and above          | `MEDIUM_AND_ABOVE` | `.blockMediumAndAbove` | `medium` | `BLOCK_MEDIUM_AND_ABOVE` |
| Block only high probability     | `ONLY_HIGH`        | `.blockOnlyHigh`       | `high`   | `BLOCK_ONLY_HIGH`        |
| Block none (always show)        | `NONE`             | `.blockNone`           | `none`   | `BLOCK_NONE`             |
| Off (safety filter turned off)  | `OFF`              | `.off`                 | `off`    | `OFF`                    |

## Android (Kotlin)

Call `generativeModel` and use the suspend function `generateContent` from a
coroutine scope (such as `lifecycleScope`):

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
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

### Optional: Custom Generation Config & Safety Settings

Build an optional config with the `generationConfig { }` DSL and pass it
together with a list of `SafetySetting`s to `generativeModel`. The
`SafetySetting` constructor takes the category and threshold positionally.

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.HarmBlockThreshold
import com.google.firebase.ai.type.HarmCategory
import com.google.firebase.ai.type.SafetySetting
import com.google.firebase.ai.type.generationConfig

// Set optional parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
val config = generationConfig {
    maxOutputTokens = 200
    stopSequences = listOf("red")
}

// Specify the config and safety settings as part of creating the `GenerativeModel` instance.
val configuredModel = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    generationConfig = config,
    safetySettings = listOf(
        SafetySetting(HarmCategory.HARASSMENT, HarmBlockThreshold.ONLY_HIGH),
        SafetySetting(HarmCategory.HATE_SPEECH, HarmBlockThreshold.MEDIUM_AND_ABOVE)
    )
)
```

## iOS (Swift)

Call `generativeModel(modelName:)` and `await generateContent(prompt)`.
`response.text` is optional, so always provide a fallback. In SwiftUI, run the
call from a `Task` inside an `@Observable` view model (see the iOS setup guide
for that pattern).

```swift
import FirebaseAILogic

let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>" // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
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

### Optional: Custom Generation Config & Safety Settings

Create an optional `GenerationConfig` struct and an array of `SafetySetting`s,
and pass both to `generativeModel(modelName:generationConfig:safetySettings:)`:

```swift
import FirebaseAILogic

// Set optional parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
let config = GenerationConfig(
  maxOutputTokens: 200,
  stopSequences: ["red"]
)

// You can configure safety thresholds to prevent the model from generating harmful content.
let safetySettings = [
  SafetySetting(harmCategory: .harassment, threshold: .blockLowAndAbove),
  SafetySetting(harmCategory: .hateSpeech, threshold: .blockMediumAndAbove)
]

let configuredModel = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>",
  generationConfig: config,
  safetySettings: safetySettings
)
```

## Flutter (Dart)

Call `generativeModel` and pass prompts as a list of `Content`. `response.text`
is nullable, so provide a fallback.

```dart
import 'package:firebase_ai/firebase_ai.dart';

Future<String> generateText(String prompt) async {
  final googleAI = FirebaseAI.googleAI();

  // [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
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

### Optional: Custom Generation Config & Safety Settings

Pass an optional `GenerationConfig` as the `generationConfig:` named argument
and a list of `SafetySetting`s as `safetySettings:` when calling
`generativeModel`. The Dart `SafetySetting` constructor has **three positional
parameters** (`category`, `threshold`, `method`); the third is a nullable
`HarmBlockMethod` that you can pass as `null`.

```dart
import 'package:firebase_ai/firebase_ai.dart';

Future<String> generateConfiguredText(String prompt) async {
  final googleAI = FirebaseAI.googleAI();

  // Set optional parameter values in a `GenerationConfig`.
  // IMPORTANT: Example values shown here. Make sure to update for your use case.
  final generationConfig = GenerationConfig(
    maxOutputTokens: 200,
    stopSequences: ['red'],
  );

  // Third positional argument is an optional HarmBlockMethod; pass null.
  final safetySettings = [
    SafetySetting(HarmCategory.harassment, HarmBlockThreshold.high, null),
    SafetySetting(HarmCategory.hateSpeech, HarmBlockThreshold.medium, null),
  ];

  final configuredModel = googleAI.generativeModel(
    model: '<latest_supported_model>',
    generationConfig: generationConfig,
    safetySettings: safetySettings,
  );

  try {
    final response = await configuredModel.generateContent([Content.text(prompt)]);
    return response.text ?? '';
  } on FirebaseAIException catch (e) {
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

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
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

## Troubleshooting

- **HTTP 400 after a model upgrade.** `frequencyPenalty`, `presencePenalty`, and
  `candidateCount` are unsupported on general-use Gemini 3.x and later models,
  and newer models (`gemini-3.7-flash`, `gemini-3.8-flash`, `gemini-4-argon`)
  reject them with HTTP 400. Remove them from the `GenerationConfig`;
  `temperature`, `topP`, and `topK` are also ignored by these models.
- **Blocked or truncated response (thrown exception).** Android
  (`PromptBlockedException` / `ResponseStoppedException`) and iOS
  (`GenerateContentError.promptBlocked` / `.responseStoppedEarly`) throw from
  `generateContent` itself, for any finish reason other than `STOP` (including
  `MAX_TOKENS`). Flutter (`FirebaseAIException`) and Web (`AIError`) throw when
  you read `.text` / `.text()` on a blocked response. A `??` / `?:` fallback on
  `text` therefore never handles a block; wrap the call in `try` / `catch` (`do`
  / `catch` in Swift). Inspect `promptFeedback.blockReason` on the response and
  `finishReason` on the first candidate, then relax the threshold for that
  category or rewrite the prompt.
- **Deprecation warnings on `GenerationConfig`.** iOS `13.0.0+`, Web
  `@firebase/ai@3.0.0+`, and the Android `firebase-ai:18.0.0+` builder setters
  mark `temperature`, `topP`, `topK`, `candidateCount`, `presencePenalty`, and
  `frequencyPenalty` as deprecated. The Kotlin `generationConfig { }` DSL and
  Flutter `firebase_ai` 4.0.0 don't warn yet, so don't rely on the compiler: use
  only `maxOutputTokens` and `stopSequences` (plus capability-specific configs)
  as shown above.

See the official text generation guide:
https://firebase.google.com/docs/ai-logic/generate-text.md.txt
