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
            val symbol = call.args["symbol"]?.jsonPrimitive?.content ?: ""
            FunctionResponsePart(call.name, getStockPrice(symbol), call.id)
        }

        // Step 5: return all function response parts in a single turn.
        val finalResponse = chat.sendMessage(content("user") {
            responseParts.forEach { part(it) }
        })
        Log.d(TAG, finalResponse.text ?: "No text in response")
    }
}
```
