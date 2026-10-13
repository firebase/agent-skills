# Function Calling (Tools)

## Android (Kotlin)

Function arguments arrive as `Map<String, JsonElement>` and the function result
is returned as a `kotlinx.serialization` `JsonObject` (add
`org.jetbrains.kotlinx:kotlinx-serialization-json` using the latest version from
Maven Central in `app/build.gradle.kts` if not already present):

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.FunctionDeclaration
import com.google.firebase.ai.type.FunctionResponsePart
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.Tool
import com.google.firebase.ai.type.content
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

// Step 1: the app-side function the model can ask you to run.
suspend fun fetchWeather(city: String): JsonObject {
    // TODO(developer): Call a real weather API. Hardcoded for demo purposes.
    return JsonObject(
        mapOf(
            "city" to JsonPrimitive(city),
            "tempC" to JsonPrimitive(22),
            "conditions" to JsonPrimitive("Sunny"),
        )
    )
}

// Step 2: describe the function to the model.
val fetchWeatherTool = FunctionDeclaration(
    "fetchWeather",
    "Get the current weather conditions for a given city.",
    mapOf("city" to Schema.string("The city and state/country, e.g. New York, NY")),
)

// Step 3: provide the declaration when creating the model.
// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    tools = listOf(Tool.functionDeclarations(listOf(fetchWeatherTool)))
)

lifecycleScope.launch {
    // Step 4: send the prompt in a chat session and run any requested call(s).
    val chat = model.startChat()
    val result = chat.sendMessage("What is the weather in New York?")

    val functionCalls = result.functionCalls.filter { it.name == "fetchWeather" }
    if (functionCalls.isNotEmpty()) {
        val responseParts = functionCalls.map { call ->
            val city = call.args["city"]?.jsonPrimitive?.content ?: ""
            FunctionResponsePart(call.name, fetchWeather(city), call.id)
        }

        // Step 5: return all function response parts in a single turn.
        val finalResponse = chat.sendMessage(content("user") {
            responseParts.forEach { part(it) }
        })
        Log.d(TAG, finalResponse.text ?: "No text in response")
    }
}
```

## iOS (Swift)

Function arguments arrive as a `JSONObject` (`[String: JSONValue]`), so pattern
match on the expected case; the function result is also a `JSONObject`:

```swift
import FirebaseAILogic

// Step 1: the app-side function the model can ask you to run.
func fetchWeather(city: String) -> JSONObject {
  // TODO(developer): Call a real weather API. Hardcoded for demo purposes.
  return [
    "city": .string(city),
    "tempC": .number(22),
    "conditions": .string("Sunny")
  ]
}

// Step 2: describe the function to the model.
let fetchWeatherDeclaration = FunctionDeclaration(
  name: "fetchWeather",
  description: "Get the current weather conditions for a given city.",
  parameters: [
    "city": .string(
      description: "The city and state/country, e.g. New York, NY"
    )
  ]
)

// Step 3: provide the declaration when creating the model.
// [AGENT] Replace "<latest_supported_model>" with the latest model applicable for the use case from https://firebase.google.com/docs/ai-logic/models.md.txt (do not use deprecated models)
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>",
  tools: [.functionDeclarations([fetchWeatherDeclaration])]
)

// Step 4: in your task, send the prompt in a chat session and run any requested call.
let chat = model.startChat()
let response = try await chat.sendMessage("What is the weather in New York?")

var functionResponses = [FunctionResponsePart]()
for functionCall in response.functionCalls {
  print("Model requested function: \(functionCall.name) with args: \(functionCall.args)")
  if functionCall.name == "fetchWeather" {
    // TODO(developer): Handle invalid arguments.
    guard case let .string(city) = functionCall.args["city"] else {
      fatalError("Missing or invalid 'city' argument in function call.")
    }
    functionResponses.append(FunctionResponsePart(
      name: functionCall.name,
      response: fetchWeather(city: city)
    ))
  }
  // TODO(developer): Handle other potential function calls, if any.
}

// Step 5: return the result(s) so the model can write its final answer.
let finalResponse = try await chat.sendMessage(
  [ModelContent(role: "user", parts: functionResponses)]
)
print(finalResponse.text ?? "No text in response.")
```

> [!WARNING] **`Tool` was renamed in Firebase iOS SDK 13.0.0.** The top-level
> `Tool` type is now `GenerativeModel.Tool`, so
> `let tool = Tool.functionDeclarations([...])` no longer compiles. Pass the
> array literal `tools: [.functionDeclarations([...])]` as above; it works on
> both old and new SDK versions.

## Flutter (Dart)

Function arguments arrive as `Map<String, Object?>` on `functionCall.args`, and
`Content.functionResponses` (or `Content.functionResponse` for a single call)
wraps your results for the follow-up turn:

```dart
import 'package:firebase_ai/firebase_ai.dart';

// Step 1: the app-side function the model can ask you to run.
Future<Map<String, Object?>> getStockPrice(String symbol) async {
  // TODO(developer): Call a real stock price API. Hardcoded for demo purposes.
  return {'symbol': symbol, 'price': 189.84};
}

// Step 2: describe the function to the model.
final getStockPriceTool = FunctionDeclaration(
  'getStockPrice',
  'Get the current stock price for a given symbol.',
  parameters: {
    'symbol': Schema.string(description: 'The stock symbol, e.g. AAPL'),
  },
);

// Step 3: provide the declaration when creating the model.
// [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
final model = FirebaseAI.googleAI().generativeModel(
  model: '<latest_supported_model>',
  tools: [Tool.functionDeclarations([getStockPriceTool])],
);

Future<String> askStockPrice() async {
  // Step 4: send the prompt in a chat session and run any requested call(s).
  final chat = model.startChat();
  var response = await chat.sendMessage(
    Content.text('What is the stock price of Apple?'),
  );

  final functionResponses = <FunctionResponse>[];
  for (final functionCall in response.functionCalls) {
    if (functionCall.name == 'getStockPrice') {
      final symbol = functionCall.args['symbol']! as String;
      final functionResult = await getStockPrice(symbol);
      functionResponses.add(
        FunctionResponse(functionCall.name, functionResult, id: functionCall.id),
      );
    }
  }

  // Step 5: return all function results in a single turn so the model can write its final answer.
  if (functionResponses.isNotEmpty) {
    response = await chat.sendMessage(
      Content.functionResponses(functionResponses),
    );
  }
  return response.text ?? 'No text in response';
}
```
