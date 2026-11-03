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
