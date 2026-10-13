# Function Calling (Tools)

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
    guard case let .string(symbol) = functionCall.args["symbol"] else {
      fatalError("Missing or invalid 'symbol' argument in function call.")
    }
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
