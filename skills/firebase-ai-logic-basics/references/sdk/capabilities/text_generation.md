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
