# Grounding with Google Search

Grounding with Google Search connects a Gemini model to real-time, publicly
available web content, so it can answer questions about recent events, reduce
hallucinations by basing responses on real-world information, and cite
verifiable sources beyond its knowledge cutoff. Reach for it when a response
must be current or must show its sources (news, prices, schedules, "who won",
region-specific facts). You enable it by adding the built-in Google Search tool
to the model; the model then decides per request whether to search, runs the
queries, and returns a "grounded result" whose `groundingMetadata` you are
**required** to display in your UI.

## Configuration

- **Provider and models**: available with the Gemini Developer API (and the
  Agent Platform Gemini API, formerly branded Vertex AI) on the current
  general-use Gemini models (Flash, Flash-Lite and Pro), on the Nano Banana
  image models, and on the Live API models. Check the "Supported models" list on
  the
  [official grounding page](https://firebase.google.com/docs/ai-logic/grounding-google-search.md.txt)
  and pick the model from
  [the models list](https://firebase.google.com/docs/ai-logic/models.md.txt).
- **Enabling it**: pass the Google Search tool in the model's `tools` when you
  create the `GenerativeModel` — `Tool.googleSearch()` on Android and Flutter,
  `.googleSearch()` (`GenerativeModel.Tool.googleSearch()`) on iOS, and
  `{ googleSearch: {} }` on Web. No other request changes are needed.
- **The model decides**: providing the tool does not force a search. If the
  model answers without searching, the response has no `groundingMetadata` and
  is *not* a grounded result.
- **What comes back**: a grounded result's candidate carries a
  `groundingMetadata` object with:
  - `webSearchQueries` — the queries the model sent to Google Search (useful for
    debugging).
  - `searchEntryPoint.renderedContent` — ready-made HTML and CSS for the "Google
    Search Suggestions" widget. It adapts to light/dark mode via
    `@media(prefers-color-scheme)`; render it as-is in a WebView or the DOM.
  - `groundingChunks` — the web sources (`web.uri`, `web.title`).
  - `groundingSupports` — links text `segment`s (`startIndex`/`endIndex`) to
    `groundingChunkIndices`, for building inline citations.
- **Pricing and limits**: Grounding with Google Search has its own pricing,
  model availability and limits — review the
  [Gemini Developer API pricing page](https://ai.google.dev/gemini-api/docs/pricing)
  before enabling it.

> [!WARNING] **Display requirements** If a response contains Google Search
> Suggestions (`searchEntryPoint` is present) it is a grounded result and you
> must comply with the "Grounding with Google Search" usage requirements of the
> [Gemini Developer API terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search):
> it is *required* to display the Google Search Suggestions from
> `renderedContent` and *required* to display the sources from
> `groundingChunks`/`groundingSupports`. Follow the
> [display and behavior requirements](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/grounding/grounding-with-google-search#requirements)
> (written for the Agent Platform Gemini API, but applicable to the Gemini
> Developer API too).

A trimmed grounded result looks like this:

```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "Spain won Euro 2024, defeating England 2-1 ..." }],
      "role": "model"
    },
    "groundingMetadata": {
      "webSearchQueries": ["UEFA Euro 2024 winner", "who won euro 2024"],
      "searchEntryPoint": {
        "renderedContent": "<!-- HTML and CSS for the search widget -->"
      },
      "groundingChunks": [
        { "web": { "uri": "https://vertexaisearch.cloud.google.com.....",
                   "title": "aljazeera.com" } },
        { "web": { "uri": "https://vertexaisearch.cloud.google.com.....",
                   "title": "uefa.com" } }
      ],
      "groundingSupports": [
        { "segment": { "startIndex": 0, "endIndex": 85,
                       "text": "Spain won Euro 2024, defeatin..." },
          "groundingChunkIndices": [0] },
        { "segment": { "startIndex": 86, "endIndex": 210,
                       "text": "This victory marks Spain's..." },
          "groundingChunkIndices": [0, 1] }
      ]
    }
  }]
}
```

The platform samples below are the *generalized* pattern from the official
guide: create the model with the search tool, generate, read the text, then read
`groundingMetadata` and surface both the Search Suggestions and the sources. It
is your responsibility to make the final UI compliant.

## Android (Kotlin)

Pass `Tool.googleSearch()` in `tools`. `generateContent` is a suspend function
and must be called from a coroutine scope. Show `renderedContent` in a
`WebView`.

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.Tool

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    // Provide Google Search as a tool that the model can use to generate its response
    tools = listOf(Tool.googleSearch())
)

val response = model.generateContent("Who won the euro 2024?")

// Get the model's response
val text = response.text

// Get the grounding metadata
val groundingMetadata = response.candidates.firstOrNull()?.groundingMetadata

// REQUIRED - display Google Search suggestions
// (renderedContent contains HTML and CSS for the search widget)
val renderedContent = groundingMetadata?.searchEntryPoint?.renderedContent
if (renderedContent != null) {
    // TODO(developer): Display Google Search suggestions using a WebView
}

// REQUIRED - display sources
groundingMetadata?.groundingChunks?.forEach { chunk ->
    val title = chunk.web?.title  // for example, "uefa.com"
    val uri = chunk.web?.uri  // for example, "https://vertexaisearch.cloud.google.com..."
    // TODO(developer): show source in the UI
}
```

## iOS (Swift)

Pass `.googleSearch()` in `tools` (the docs write `Tool.googleSearch()`; the
implicit-member form compiles whether the SDK exposes `Tool` at top level or as
`GenerativeModel.Tool`). Show `renderedContent` in a `WKWebView`.

```swift
import FirebaseAILogic

let ai = FirebaseAI.firebaseAI(backend: .googleAI())

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = ai.generativeModel(
  modelName: "<latest_supported_model>",
  // Provide Google Search as a tool that the model can use to generate its response.
  tools: [.googleSearch()]
)

let response = try await model.generateContent("Who won the euro 2024?")

// Get the model's response
let text = response.text

// Get the grounding metadata
if let candidate = response.candidates.first,
   let groundingMetadata = candidate.groundingMetadata {
  // REQUIRED - display Google Search suggestions
  // (renderedContent contains HTML and CSS for the search widget)
  if let renderedContent = groundingMetadata.searchEntryPoint?.renderedContent {
    // TODO(developer): Display Google Search suggestions using a WebView
  }

  // REQUIRED - display sources
  for chunk in groundingMetadata.groundingChunks {
    if let web = chunk.web {
      let title = web.title  // for example, "uefa.com"
      let uri = web.uri  // for example, "https://vertexaisearch.cloud.google.com..."
      // TODO(developer): show source in the UI
    }
  }
}
```

## Flutter (Dart)

Pass `Tool.googleSearch()` in `tools`. Show `renderedContent` with a WebView
plugin (for example `webview_flutter`).

```dart
import 'package:firebase_ai/firebase_ai.dart';

// [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(
  model: '<latest_supported_model>',
  // Provide Google Search as a tool that the model can use to generate its response.
  tools: [
    Tool.googleSearch(),
  ],
);

final response = await model.generateContent([Content.text("Who won the euro 2024?")]);

// Get the model's response
final text = response.text;

// Get the grounding metadata
final groundingMetadata = response.candidates.firstOrNull?.groundingMetadata;

// REQUIRED - display Google Search suggestions
// (renderedContent contains HTML and CSS for the search widget)
final renderedContent = groundingMetadata?.searchEntryPoint?.renderedContent;
if (renderedContent != null) {
  // TODO(developer): Display Google Search suggestions using a WebView
}

// REQUIRED - display sources
final groundingChunks = groundingMetadata?.groundingChunks;
if (groundingChunks != null) {
  for (var chunk in groundingChunks) {
    final title = chunk.web?.title;  // for example, "uefa.com"
    final uri = chunk.web?.uri;  // for example, "https://vertexaisearch.cloud.google.com..."
    // TODO(developer): show sources in the UI
  }
}
```

## Web (JavaScript)

Pass `{ googleSearch: {} }` in `tools`. `ai` is the instance returned by
`getAI(app, { backend: new GoogleAIBackend() })` during setup. Insert
`renderedContent` into the DOM as-is (it already includes its CSS).

```javascript
import { getGenerativeModel } from "firebase/ai";

const model = getGenerativeModel(ai, {
  model: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  // Provide Google Search as a tool that the model can use to generate its response
  tools: [{ googleSearch: {} }]
});

const result = await model.generateContent("Who won the euro 2024?");

// Get the model's text response
const text = result.response.text();

// Get the grounding metadata
const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;

// REQUIRED - display Google Search suggestions
// (renderedContent contains HTML and CSS for the search widget)
const renderedContent = groundingMetadata?.searchEntryPoint?.renderedContent;
if (renderedContent) {
  // TODO(developer): render this HTML and CSS in the UI
}

// REQUIRED - display sources
const groundingChunks = groundingMetadata?.groundingChunks;
if (groundingChunks) {
  for (const chunk of groundingChunks) {
    const title = chunk.web?.title;  // for example, "uefa.com"
    const uri = chunk.web?.uri;  // for example, "https://vertexaisearch.cloud.google.com..."
    // TODO(developer): show sources in the UI
  }
}
```

## Troubleshooting

- **`groundingMetadata` is null/undefined.** The model chose not to search for
  that prompt; the answer is not a grounded result and there is nothing to
  display. Do not assume every response with the tool enabled is grounded.
- **The Search Suggestions widget looks wrong.** Render `renderedContent`
  unmodified (its HTML and CSS are the compliant styling) in a WebView or the
  DOM; do not restyle it or extract only the text.
- **Source URIs point at `vertexaisearch.cloud.google.com`.** That is expected
  (the example response in the official guide shows the same hosts); show the
  `title`, which is the source domain, as the label and open the `uri` when
  tapped.

See the official Grounding with Google Search guide:
https://firebase.google.com/docs/ai-logic/grounding-google-search

Last verified against
https://firebase.google.com/docs/ai-logic/grounding-google-search.md.txt and the
Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk,
flutterfire; `main` branches) on 2026-10-08.
