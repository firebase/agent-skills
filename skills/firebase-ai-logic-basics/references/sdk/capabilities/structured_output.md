# Structured Output (JSON)

The Gemini API returns unstructured text by default. When your app needs to
parse the response (render it in a list, store it, hand it to another step),
define a *response schema* and set the response MIME type to `application/json`
so the model always returns JSON that conforms to the schema. This is sometimes
called "JSON mode" or "controlled generation". It works with text-only prompts
and with multimodal requests (images, audio, video, PDF input), and the same
mechanism with `text/x.enum` constrains classification tasks to a fixed set of
labels. Supported by the general-use Gemini models; check
[the models list](https://firebase.google.com/docs/ai-logic/models.md.txt).

## Configuration

- **Where it goes**: both `responseMimeType` and `responseSchema` are fields of
  the model's generation config, set when you create the `GenerativeModel`.
  Setting a `responseSchema` requires a compatible `responseMimeType`.
- **Supported MIME types**:
  - `application/json` — output JSON as defined in the response schema.
  - `text/x.enum` — output a single plain-text enum value from the schema
    (useful for classification). Do not JSON-parse this response.
- **Building a schema**: use the SDK's `Schema` helpers rather than raw JSON.
  Every SDK offers object, array, string, integer, floating-point, boolean and
  enum builders (`Schema.obj`/`Schema.object`, `Schema.array`, `Schema.string`,
  `Schema.integer`, `Schema.double`/`Schema.number`, `Schema.boolean`,
  `Schema.enumeration`/`Schema.enumString`). Each builder accepts an optional
  `description` — use clear field names and descriptions, because the model uses
  them together with your prompt to decide what to put in each field.
- **Optional properties**: with the Firebase AI Logic SDKs **all properties are
  required by default** unless you list them in the object's
  `optionalProperties` array (the model may then fill or skip them). This is the
  opposite of the default when calling the Gemini API directly or via its server
  SDKs.
- **Supported schema fields**: `anyOf`, `description`, `enum`, `format`,
  `items`, `maxItems`, `minItems`, `minimum`, `maximum`, `nullable`,
  `properties`, `propertyOrdering`, `required`, and `title` (a subset of the
  OpenAPI 3.0 schema object; for full JSON Schema features like `$ref`/`$defs`,
  use `responseJsonSchema` or Android's `@Generable` KSP processor).
- **Limits**: the response schema counts toward the model's input token limit,
  so keep schemas as small as the task allows.
- **Parsing**: the model's reply arrives as a JSON string in the response
  `text`; parse it with the platform's JSON library (`org.json`/`kotlinx`,
  `JSONDecoder`, `dart:convert`, `JSON.parse`).

The samples below all use the same schema from the official guide: an object
with a `characters` array, where each character has a `name`, `age`, `species`
and an optional `accessory` enum.

## Android (Kotlin)

Build the schema with `Schema.obj` / `Schema.array` / `Schema.enumeration`, then
pass it in `generationConfig { }`. `generateContent` is a suspend function and
must be called from a coroutine scope.

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.generationConfig
import org.json.JSONObject

// Provide a JSON schema object using a standard format.
// Later, pass this schema object into `responseSchema` in the generation config.
val jsonSchema = Schema.obj(
    mapOf("characters" to Schema.array(
        Schema.obj(
            mapOf(
                "name" to Schema.string(),
                "age" to Schema.integer(),
                "species" to Schema.string(),
                "accessory" to Schema.enumeration(listOf("hat", "belt", "shoes")),
            ),
            optionalProperties = listOf("accessory")
        )
    ))
)

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    // In the generation config, set the `responseMimeType` to `application/json`
    // and pass the JSON schema object into `responseSchema`.
    generationConfig = generationConfig {
        responseMimeType = "application/json"
        responseSchema = jsonSchema
    })

val prompt = "For use in a children's card game, generate 10 animal-based characters."
val response = model.generateContent(prompt)

// `response.text` is a JSON string that conforms to the schema.
val characters = JSONObject(response.text ?: "{}").getJSONArray("characters")
```

## iOS (Swift)

Build the schema with `Schema.object` / `Schema.array` / `Schema.enumeration`
and pass it in `GenerationConfig`. Note the Swift label is `responseMIMEType`.

```swift
import FirebaseAILogic

struct GameCharacter: Decodable {
  let name: String; let age: Int; let species: String; let accessory: String?
}
struct Deck: Decodable { let characters: [GameCharacter] }

// Provide a JSON schema object using a standard format.
// Later, pass this schema object into `responseSchema` in the generation config.
let jsonSchema = Schema.object(
  properties: [
    "characters": Schema.array(
      items: .object(
        properties: [
          "name": .string(),
          "age": .integer(),
          "species": .string(),
          "accessory": .enumeration(values: ["hat", "belt", "shoes"]),
        ],
        optionalProperties: ["accessory"]
      )
    ),
  ]
)

let ai = FirebaseAI.firebaseAI(backend: .googleAI())

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = ai.generativeModel(
  modelName: "<latest_supported_model>",
  // In the generation config, set the `responseMimeType` to `application/json`
  // and pass the JSON schema object into `responseSchema`.
  generationConfig: GenerationConfig(
    responseMIMEType: "application/json",
    responseSchema: jsonSchema
  )
)

let prompt = "For use in a children's card game, generate 10 animal-based characters."
let response = try await model.generateContent(prompt)

// `response.text` is a JSON string that conforms to the schema.
let deck = try JSONDecoder().decode(Deck.self, from: Data((response.text ?? "{}").utf8))
```

## Flutter (Dart)

Build the schema with `Schema.object` / `Schema.array` / `Schema.enumString` and
pass it in `GenerationConfig`. Put `optionalProperties` on the object that owns
the optional field.

```dart
import 'dart:convert';
import 'package:firebase_ai/firebase_ai.dart';

// Provide a JSON schema object using a standard format.
// Later, pass this schema object into `responseSchema` in the generation config.
final jsonSchema = Schema.object(
  properties: {
    'characters': Schema.array(
      items: Schema.object(
        properties: {
          'name': Schema.string(),
          'age': Schema.integer(),
          'species': Schema.string(),
          'accessory': Schema.enumString(enumValues: ['hat', 'belt', 'shoes']),
        },
        optionalProperties: ['accessory'],
      ),
    ),
  },
);

// [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(
  model: '<latest_supported_model>',
  // In the generation config, set the `responseMimeType` to `application/json`
  // and pass the JSON schema object into `responseSchema`.
  generationConfig: GenerationConfig(
    responseMimeType: 'application/json',
    responseSchema: jsonSchema,
  ),
);

final prompt = "For use in a children's card game, generate 10 animal-based characters.";
final response = await model.generateContent([Content.text(prompt)]);

// `response.text` is a JSON string that conforms to the schema.
final json = jsonDecode(response.text ?? '{}') as Map<String, dynamic>;
final characters = json['characters'] as List<dynamic>;
```

## Web (JavaScript)

Enforce a specific JSON schema for the response. `ai` is the instance returned
by `getAI(app, { backend: new GoogleAIBackend() })` during setup. The schema is
optional: with only `responseMimeType: "application/json"` the model still
returns JSON, but chooses the shape itself.

```javascript
import { getGenerativeModel, Schema } from "firebase/ai";

// Provide a JSON schema object using a standard format.
// Later, pass this schema object into `responseSchema` in the generation config.
const jsonSchema = Schema.object({
  properties: {
    characters: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string(),
          age: Schema.integer(),
          species: Schema.string(),
          accessory: Schema.enumString({ enum: ["hat", "belt", "shoes"] }),
        },
        optionalProperties: ["accessory"],
      }),
    }),
  },
});

const jsonModel = getGenerativeModel(ai, {
  model: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  generationConfig: {
    responseMimeType: "application/json",
    // Optional: Define a schema
    responseSchema: jsonSchema
  }
});

async function getJsonData(prompt) {
  const result = await jsonModel.generateContent(prompt);
  return JSON.parse(result.response.text());
}

const data = await getJsonData(
  "For use in a children's card game, generate 10 animal-based characters."
);
console.log(data.characters);
```

## Troubleshooting

- **The model omits a field or returns extra ones.** All properties are required
  unless listed in `optionalProperties`; the model ignores schema fields outside
  the supported set listed above, so express constraints with `enum`,
  `nullable`, `maxItems` and descriptions instead of unsupported keywords.
- **Error when `optionalProperties` references an unknown key.** `Schema.obj`
  (Android throws `IllegalArgumentException`), `Schema.object` (iOS triggers
  `fatalError`, Web throws `AIError` `INVALID_SCHEMA`) validate that every name
  in `optionalProperties` exists in `properties` — put `optionalProperties` on
  the object that directly owns the field.
- **Parsing fails on a `text/x.enum` response.** That MIME type returns a bare
  enum string (for example `comedy`), not JSON; read `response.text` directly.
- **Request rejected after adding a schema.** `responseSchema` requires a
  compatible `responseMimeType` (`application/json` or `text/x.enum`) in the
  same generation config.

See the official structured output guide:
https://firebase.google.com/docs/ai-logic/generate-structured-output

Last verified against
https://firebase.google.com/docs/ai-logic/generate-structured-output.md.txt and
the Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk,
firebase-js-sdk, flutterfire; `main` branches) on 2026-10-08.
