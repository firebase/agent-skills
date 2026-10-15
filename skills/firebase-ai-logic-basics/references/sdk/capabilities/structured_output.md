# Structured Output (JSON)

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
  // In the generation config, set the `responseMIMEType` to `application/json`
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
