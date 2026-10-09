# Function Calling (Tools)

Define functions that the model can request to execute to interact with external
systems. Function calling (also called *tool use*) lets a Gemini model overcome
stale training data and its inability to query or modify external data: you
describe your app's functions to the model, the model replies with structured
arguments when it wants one called, your app executes the function, and you send
the result back so the model can write its final answer. *Note: Advanced
workflows like function calling generally require a multi-turn Chat Session to
handle the back-and-forth execution.* Use it whenever the answer depends on live
data (prices, weather, inventory), a database lookup, or an action in your app.

## Configuration

The round trip is the same on every platform:

1. **Write the function** in your app (call an API, query a database, compute a
   value). It returns a JSON-like map.
1. **Declare it** with a `FunctionDeclaration` (name, description, parameter
   schema). Put as much detail as possible in the descriptions; the model uses
   them to decide which function to call and how to fill the arguments.
1. **Pass the declaration as a tool** when creating the model. You can provide
   up to 128 function declarations.
1. **Send the prompt in a chat session** and inspect the response's
   `functionCalls`. *The model never calls your function directly* — it returns
   the function name plus structured arguments, and your app runs it.
1. **Send a `FunctionResponse` part back** (role `user`) containing your
   function's output. The model then generates its final natural-language
   response.

Schema rules for the parameter declaration:

- Schemas follow a subset of OpenAPI. Supported attributes: `type`, `nullable`,
  `required`, `format`, `description`, `properties`, `items`, `enum`, `minimum`,
  `maximum`, `minItems`, `maxItems`, `anyOf`, `title`. Not supported: `default`,
  `optional`, `oneOf`.
- **All parameters are required by default.** Mark optional ones in the
  declaration's `optionalParameters` list on Android, iOS, and Flutter, or in
  `optionalProperties` on
  `Schema.object({ properties: {...}, optionalProperties: [...] })` on Web
  (`firebase/ai` does not have `optionalParameters`, and passing
  `optionalParameters` to `Schema.object()` sends an invalid key to the API).
- Nested objects are declared with `Schema.obj` (Kotlin), `.object(properties:)`
  (Swift) or `Schema.object` (Dart, Web); the official guide's `fetchWeather`
  sample shows a nested `location` object.

Behaviour your app must accommodate:

- The model may ask for **another call** (same or different function) after
  receiving a result, and may ask for **several calls at once** (parallel
  function calling). Loop until the response contains no function calls, and
  return a response part for every call.
- You can constrain the model with a tool config (**function calling mode**):
  `AUTO` (default — model chooses between text and a call), `ANY` (forced
  function calling; optionally restrict to `allowedFunctionNames`), or `NONE`.
- Function calling is supported by the general-use Gemini models; see
  https://firebase.google.com/docs/ai-logic/function-calling.md.txt for the
  current model list and the details of `toolConfig`.

This file uses one `getStockPrice(symbol)` example on every platform so the flow
is identical across Android, iOS, Flutter and Web.

## Android (Kotlin)

Function arguments arrive as `Map<String, JsonElement>` and the function result
is returned as a `kotlinx.serialization` `JsonObject` (add
`implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")` to
`app/build.gradle.kts` if not already present):

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
suspend fun getStockPrice(symbol: String): JsonObject {
    // TODO(developer): Call a real stock price API. Hardcoded for demo purposes.
    return JsonObject(mapOf("symbol" to JsonPrimitive(symbol), "price" to JsonPrimitive(189.84)))
}

// Step 2: describe the function to the model.
val getStockPriceTool = FunctionDeclaration(
    "getStockPrice",
    "Get the current stock price for a given symbol.",
    mapOf("symbol" to Schema.string("The stock symbol, e.g. AAPL")),
)

// Step 3: provide the declaration when creating the model.
// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
    modelName = "<latest_supported_model>",
    tools = listOf(Tool.functionDeclarations(listOf(getStockPriceTool)))
)

lifecycleScope.launch {
    // Step 4: send the prompt in a chat session and run any requested call(s).
    val chat = model.startChat()
    val result = chat.sendMessage("What is the stock price of Apple?")

    val functionCalls = result.functionCalls.filter { it.name == "getStockPrice" }
    if (functionCalls.isNotEmpty()) {
        val responseParts = functionCalls.map { call ->
            val symbol = call.args["symbol"]!!.jsonPrimitive.content
            FunctionResponsePart(call.name, getStockPrice(symbol))
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
func getStockPrice(symbol: String) -> JSONObject {
  // TODO(developer): Call a real stock price API. Hardcoded for demo purposes.
  return ["symbol": .string(symbol), "price": .number(189.84)]
}

// Step 2: describe the function to the model.
let getStockPriceDeclaration = FunctionDeclaration(
  name: "getStockPrice",
  description: "Get the current stock price for a given symbol.",
  parameters: [
    "symbol": .string(
      description: "The stock symbol, e.g. AAPL"
    )
  ]
)

// Step 3: provide the declaration when creating the model.
let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
  modelName: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  tools: [.functionDeclarations([getStockPriceDeclaration])]
)

// Step 4: in your task, send the prompt in a chat session and run any requested call.
let chat = model.startChat()
let response = try await chat.sendMessage("What is the stock price of Apple?")

var functionResponses = [FunctionResponsePart]()
for functionCall in response.functionCalls {
  print("Model requested function: \(functionCall.name) with args: \(functionCall.args)")
  if functionCall.name == "getStockPrice" {
    // TODO(developer): Handle invalid arguments.
    guard case let .string(symbol) = functionCall.args["symbol"] else { fatalError() }
    functionResponses.append(FunctionResponsePart(
      name: functionCall.name,
      response: getStockPrice(symbol: symbol)
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

## Web (JavaScript)

Declare the tool as a plain object with a `functionDeclarations` array (use the
`Schema` helpers for the parameters), read `functionCalls()` from the response,
and send the `functionResponse` part(s) back in a single turn:

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from "firebase/ai";

// Step 1: the app-side function the model can ask you to run.
async function getStockPrice({ symbol }) {
  // TODO(developer): Call a real stock price API. Hardcoded for demo purposes.
  return { symbol, price: 189.84 };
}

// Step 2: describe the function to the model.
const getStockPriceTool = {
  functionDeclarations: [
    {
      name: "getStockPrice",
      description: "Get the current stock price for a given symbol.",
      parameters: Schema.object({
        properties: {
          symbol: Schema.string({ description: "The stock symbol, e.g. AAPL" }),
        },
      }),
    },
  ],
};

// Step 3: provide the declaration when creating the model.
const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  model: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  tools: [getStockPriceTool],
});

async function askStockPrice() {
  // Step 4: send the prompt in a chat session and run any requested call(s).
  const chat = model.startChat();
  let result = await chat.sendMessage("What is the stock price of Apple?");

  const functionResponses = [];
  for (const call of result.response.functionCalls() ?? []) {
    if (call.name === "getStockPrice") {
      const functionResult = await getStockPrice(call.args);
      functionResponses.push({
        type: "functionResponse",
        functionResponse: { id: call.id, name: call.name, response: functionResult },
      });
    }
  }

  // Step 5: return all function results in a single turn so the model can write its final answer.
  if (functionResponses.length > 0) {
    result = await chat.sendMessage(functionResponses);
  }
  return result.response.text();
}
```

## Troubleshooting

- **`response.text` is empty/nil on the first turn.** That is expected when the
  model chose to call a function: the turn contains `functionCalls` instead of
  text. Execute the call and send the `FunctionResponse` part back; the text
  arrives in the follow-up response.
- **The model never calls the function.** Improve the function and parameter
  descriptions (they are the only thing the model sees), or force a call by
  setting the function calling mode to `ANY` in the tool config.
- **Android: `Unresolved reference: JsonObject` / `jsonPrimitive`.** The
  `firebase-ai` artifact only pulls `kotlinx-serialization-json` in at runtime.
  Add `org.jetbrains.kotlinx:kotlinx-serialization-json` as an `implementation`
  dependency of your app module to compile the samples above.
- **iOS: `Cannot find 'Tool' in scope`.** You are on Firebase iOS SDK 13+; use
  `tools: [.functionDeclarations([...])]` or `GenerativeModel.Tool`.
- **Schema rejected by the API.** Remove unsupported attributes (`default`,
  `optional`, `oneOf`) and declare optional fields through `optionalParameters`
  (Android, iOS, Flutter) or `Schema.object({ properties, optionalProperties })`
  (Web) instead.

See the official function calling guide:
https://firebase.google.com/docs/ai-logic/function-calling

Last verified against
https://firebase.google.com/docs/ai-logic/function-calling.md.txt and the
Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk,
flutterfire; `main` branches) on 2026-10-08.
