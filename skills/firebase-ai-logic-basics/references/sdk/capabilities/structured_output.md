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
