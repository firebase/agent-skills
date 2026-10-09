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

A `GenerationConfig` is passed when creating the `GenerativeModel` and is kept
for the lifetime of that instance; to use different values, create a new model
instance. Full parameter descriptions:
https://firebase.google.com/docs/ai-logic/model-parameters.md.txt

| Parameter         | What it controls                                                                                                                                | Status on general-use Gemini 3.x models                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `maxOutputTokens` | Maximum number of tokens that can be generated in the response.                                                                                 | Supported                                                        |
| `stopSequences`   | Strings that make the model stop generating when one of them appears in the response.                                                           | Supported (not applicable to image or TTS models)                |
| `temperature`     | Degree of randomness. Lower is more deterministic, higher is more diverse or creative.                                                          | Ignored                                                          |
| `topP`            | Nucleus sampling: tokens are picked from most to least probable until their probabilities sum to `topP`.                                        | Ignored                                                          |
| `topK`            | Limits sampling to the `k` most probable tokens for each step.                                                                                  | Ignored                                                          |
| `candidateCount`  | Number of response variations to return (1–8). `generateContent` only, not streaming. You are charged for the output tokens of every candidate. | Request **fails with HTTP 400** starting with `gemini-3.7-flash` |

> [!WARNING] **Gemini 3.x drops the sampling parameters.** For the latest
> general-use Gemini 3.x models `temperature`, `topK` and `topP` are ignored,
> and `candidateCount`, `frequencyPenalty` and `presencePenalty` make the
> request fail with a 400 error starting with `gemini-3.7-flash`. Prefer
> `maxOutputTokens` and `stopSequences` in new code, and remove the other
> parameters when upgrading an existing app.

`GenerationConfig` also carries capability-specific fields (`responseMimeType`
and `responseSchema` for structured output, `responseModalities`,
`thinkingConfig`, `speechConfig`, `imageConfig`); those are covered by the
capability that needs them (for example structured output, image generation and
text-to-speech) rather than here.

### Safety settings

Safety settings adjust the likelihood of getting responses that may be
considered harmful. By default the model blocks content with a medium or high
probability of being unsafe across all categories. You configure one
`SafetySetting` per harm category when creating the `GenerativeModel`; each
pairs a category with a block threshold. Gemini Live API models do **not**
support safety settings. Details:
https://firebase.google.com/docs/ai-logic/safety-settings.md.txt

Harm categories, with the enum name used by each SDK:

| Category          | Kotlin              | Swift               | Dart               | Web                               |
| ----------------- | ------------------- | ------------------- | ------------------ | --------------------------------- |
| Harassment        | `HARASSMENT`        | `.harassment`       | `harassment`       | `HARM_CATEGORY_HARASSMENT`        |
| Hate speech       | `HATE_SPEECH`       | `.hateSpeech`       | `hateSpeech`       | `HARM_CATEGORY_HATE_SPEECH`       |
| Sexually explicit | `SEXUALLY_EXPLICIT` | `.sexuallyExplicit` | `sexuallyExplicit` | `HARM_CATEGORY_SEXUALLY_EXPLICIT` |
| Dangerous content | `DANGEROUS_CONTENT` | `.dangerousContent` | `dangerousContent` | `HARM_CATEGORY_DANGEROUS_CONTENT` |

Block thresholds, from strictest to most permissive:

| Threshold                        | Kotlin             | Swift                  | Dart     | Web                      |
| -------------------------------- | ------------------ | ---------------------- | -------- | ------------------------ |
| Block low probability and above  | `LOW_AND_ABOVE`    | `.blockLowAndAbove`    | `low`    | `BLOCK_LOW_AND_ABOVE`    |
| Block medium and above (default) | `MEDIUM_AND_ABOVE` | `.blockMediumAndAbove` | `medium` | `BLOCK_MEDIUM_AND_ABOVE` |
| Block only high probability      | `ONLY_HIGH`        | `.blockOnlyHigh`       | `high`   | `BLOCK_ONLY_HIGH`        |
| Block none (always show)         | `NONE`             | `.blockNone`           | `none`   | `BLOCK_NONE`             |
| Off (safety filter turned off)   | `OFF`              | `.off`                 | `off`    | `OFF`                    |

## Android (Kotlin)

Build the config with the `generationConfig { }` DSL, pass it together with a
list of `SafetySetting`s to `generativeModel`, then call the suspend function
`generateContent` from a coroutine scope (for example `lifecycleScope`). The
`SafetySetting` constructor takes the category and threshold positionally.

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.HarmBlockThreshold
import com.google.firebase.ai.type.HarmCategory
import com.google.firebase.ai.type.SafetySetting
import com.google.firebase.ai.type.generationConfig

// Set parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
val config = generationConfig {
    maxOutputTokens = 200
    stopSequences = listOf("red")
}

// Specify the config and safety settings as part of creating the `GenerativeModel` instance.
// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    generationConfig = config,
    safetySettings = listOf(
        SafetySetting(HarmCategory.HARASSMENT, HarmBlockThreshold.ONLY_HIGH),
        SafetySetting(HarmCategory.HATE_SPEECH, HarmBlockThreshold.MEDIUM_AND_ABOVE)
    )
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

Create a `GenerationConfig` struct and an array of `SafetySetting`s, pass both
to `generativeModel(modelName:generationConfig:safetySettings:)`, then `await`
`generateContent`. `response.text` is optional, so always provide a fallback. In
SwiftUI, run the call from a `Task` inside an `@Observable` view model (see the
iOS setup guide for that pattern).

```swift
import FirebaseAILogic

// Set parameter values in a `GenerationConfig`.
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

let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  generationConfig: config,
  safetySettings: safetySettings
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

Pass a `GenerationConfig` as the `generationConfig:` named argument and a list
of `SafetySetting`s as `safetySettings:` when calling `generativeModel`. The
Dart `SafetySetting` constructor has **three positional parameters**
(`category`, `threshold`, `method`); the third is a nullable `HarmBlockMethod`
that you can pass as `null`. Prompts are passed as a list of `Content`.

```dart
import 'package:firebase_ai/firebase_ai.dart';

Future<String> generateText(String prompt) async {
  final googleAI = FirebaseAI.googleAI();

  // Set parameter values in a `GenerationConfig`.
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

  // [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  final model = googleAI.generativeModel(
    model: '<latest_supported_model>',
    generationConfig: generationConfig,
    safetySettings: safetySettings,
    // Optional system instruction: systemInstruction: Content.system('You are a helpful assistant.'),
  );

  final response = await model.generateContent([Content.text(prompt)]);
  return response.text ?? 'No response';
}
```

## Web (JavaScript)

Pass plain objects for `generationConfig` and `safetySettings` in the options of
`getGenerativeModel`; `HarmCategory` and `HarmBlockThreshold` are exported from
`firebase/ai`. `generateContent` resolves to a result whose `response.text()`
returns the generated text.

```javascript
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  HarmBlockThreshold,
  HarmCategory,
} from "firebase/ai";

// Initialize the AI Logic service (defaults to Gemini Developer API)
const ai = getAI(app, { backend: new GoogleAIBackend() });

// Set parameter values in a `GenerationConfig`.
// IMPORTANT: Example values shown here. Make sure to update for your use case.
// For the latest general-use Gemini models, the following parameters are now unsupported:
// temperature, top-K, top-P, frequency penalty, presence penalty, and candidate count
const generationConfig = {
  maxOutputTokens: 2048,
  stopSequences: [],
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

// Specify the config as part of creating the `GenerativeModel` instance
// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
const model = getGenerativeModel(ai, { model: "<latest_supported_model>",  generationConfig, safetySettings });

async function generateText(prompt) {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}
```

## Troubleshooting

- **HTTP 400 after a model upgrade.** `frequencyPenalty`, `presencePenalty`, or
  `candidateCount` on Gemini 3.x models (`gemini-3.7-flash` and later) can cause
  requests to be rejected or ignored. Remove them from the `GenerationConfig`;
  `temperature`, `topP`, and `topK` are also ignored by general-use Gemini 3.x
  models.
- **Blocked response (`null` `text` or thrown exception).** When a prompt or
  candidate is blocked by safety or recitation filters, Android returns `null`
  from `response.text`, whereas iOS (`GenerateContentError`), Flutter
  (`FirebaseAIException`), and Web (`AIError`) throw an exception when reading
  `.text` / `.text()` (or from `generateContent` on iOS). Inspect
  `promptFeedback.blockReason` on the response and `finishReason` on the first
  candidate, then relax the threshold for that category or rewrite the prompt.
- **Deprecation warnings on `GenerationConfig`.** All four SDKs (Android
  `firebase-ai:18.0.0+`, iOS `13.0.0+`, Flutter `firebase_ai:4.0.0+`, and Web
  `@firebase/ai@3.0.0+`) mark `temperature`, `topP`, `topK`, `candidateCount`,
  `presencePenalty`, and `frequencyPenalty` as deprecated on `GenerationConfig`;
  use only `maxOutputTokens` and `stopSequences` (plus capability-specific
  configs) as shown above.

See the official text generation guide:
https://firebase.google.com/docs/ai-logic/generate-text

Last verified against
https://firebase.google.com/docs/ai-logic/generate-text.md.txt,
https://firebase.google.com/docs/ai-logic/model-parameters.md.txt,
https://firebase.google.com/docs/ai-logic/safety-settings.md.txt, and the
Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk,
flutterfire; `main` branches) on 2026-10-08.
