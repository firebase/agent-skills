# Firebase AI Logic iOS Setup Guide

## 1. Import and Initialize

Ensure you have installed the `FirebaseAILogic` SDK via Swift Package Manager.

```swift
import FirebaseAILogic

// To enable replay protection for generative or preview models, pass
// useLimitedUseAppCheckTokens: true with your backend:
let ai = FirebaseAI.firebaseAI(
    backend: .googleAI(),
    useLimitedUseAppCheckTokens: true
)

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
let model = ai.generativeModel(modelName: "<latest_supported_model>")
```

### App Check Replay Protection

Generative and preview models enforce replay protection with 5-minute
limited-use App Check tokens. If you call a protected model without enabling
limited-use tokens, the request fails with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

To resolve this error, initialize `FirebaseAI` with
`useLimitedUseAppCheckTokens: true`:

```swift
let ai = FirebaseAI.firebaseAI(
    backend: .googleAI(),
    useLimitedUseAppCheckTokens: true
)
```

This ensures the SDK fetches a fresh, short-lived limited-use token for each
request rather than reusing a standard cached App Check token.

## 2. SwiftUI Integration (Best Practices)

Use the `@Observable` pattern to manage AI state and provide a smooth UX with
loading indicators and error handling.

> **⛔️ CRITICAL WARNING:** Do NOT initialize the model inline as a class
> property if there's any chance the view model is instantiated before
> `FirebaseApp.configure()` executes in the app root. To be safe, initialize the
> model lazily or pass it in from a point in the hierarchy where Firebase is
> guaranteed to be configured.

```swift
import SwiftUI
import FirebaseAILogic

@MainActor
@Observable
final class AIViewModel {
    // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
    private lazy var model = FirebaseAI.firebaseAI(
        backend: .googleAI(),
        useLimitedUseAppCheckTokens: true
    ).generativeModel(modelName: "<latest_supported_model>")
    
    var responseText: String = ""
    var isFetching: Bool = false
    var errorMessage: String?
    
    func generate(prompt: String) async {
        isFetching = true
        errorMessage = nil
        defer { isFetching = false }
        
        do {
            let response = try await model.generateContent(prompt)
            self.responseText = response.text ?? "No response"
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }
}

struct AIView: View {
    @State private var viewModel = AIViewModel()
    @State private var prompt = "Write a story about a magic backpack."
    
    var body: some View {
        VStack {
            TextField("Enter prompt", text: $prompt)
            
            Button("Generate") {
                Task { await viewModel.generate(prompt: prompt) }
            }
            .disabled(viewModel.isFetching)
            
            if viewModel.isFetching {
                ProgressView()
            } else if let error = viewModel.errorMessage {
                Text(error).foregroundStyle(.red)
            } else {
                ScrollView {
                    Text(viewModel.responseText)
                }
            }
        }
        .padding()
    }
}
```

## 3. Safety Settings

You can configure safety thresholds to prevent the model from generating harmful
content.

```swift
let safetySettings = [
  SafetySetting(harmCategory: .harassment, threshold: .blockLowAndAbove),
  SafetySetting(harmCategory: .hateSpeech, threshold: .blockMediumAndAbove)
]

let model = FirebaseAI.firebaseAI().generativeModel(
  modelName: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  safetySettings: safetySettings
)
```

# Advanced Features

### Chat Session (Multi-turn)

Chat sessions persist state across multiple interactions, which is essential for
ongoing conversations or when using tools like function calling.

```swift
let chat = model.startChat()

Task {
    do {
        let response1 = try await chat.sendMessage("Hello! I have two dogs in my house.")
        print(response1.text ?? "")

        let response2 = try await chat.sendMessage("How many paws are in my house?")
        print(response2.text ?? "")
    } catch {
        print("Error in chat: \(error)")
    }
}
```

### Function Calling (Tools)

Define functions that the model can request to execute to interact with external
systems. *Note: Advanced workflows like function calling generally require a
multi-turn Chat Session to handle the back-and-forth execution.*

```swift
let getStockPriceTool = Tool.functionDeclarations([
  FunctionDeclaration(
    name: "getStockPrice",
    description: "Get the current stock price for a given symbol.",
    parameters: [
      "symbol": .string(
        description: "The stock symbol, e.g. AAPL"
      )
    ]
  )
])

let model = FirebaseAI.firebaseAI().generativeModel(
  modelName: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  tools: [getStockPriceTool]
)

// In your task (using a chat session):
let chat = model.startChat()
let response = try await chat.sendMessage("What is the stock price of Apple?")
if let functionCall = response.functionCalls.first {
    // Handle the function call (e.g. call a local API and send the result back)
    print("Model requested function: \(functionCall.name) with args: \(functionCall.args)")
}
```

### App Check (Debug Token Persistence)

When running on simulators or during development, the Firebase iOS SDK generates
a new debug token UUID whenever `NSUserDefaults` is cleared (e.g., simulator
reset or fresh install). To avoid invalidating tokens registered in the Firebase
Console and prevent token churn, persist a stable token by setting the
`AppCheckDebugToken` environment variable:

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Debug tokens
> grant access to backend resources without device attestation. Never commit
> debug tokens to version control or hardcode token strings in source code.

- **In Xcode Scheme (Recommended):** Edit Scheme -> Run -> Arguments ->
  Environment Variables -> Add `AppCheckDebugToken = <YOUR_DEBUG_TOKEN>`. Keep
  user schemes (`xcuserdata/`) unshared and gitignored.
- **In Code (Safe Dynamic Loading Only):** If setting the environment variable
  in code before configuring `AppCheckDebugProviderFactory`, load the token
  dynamically from a gitignored local file or environment rather than hardcoding
  the token literal:

```swift
#if DEBUG
// ✅ SAFE: Load from gitignored local file or process environment
// Note: loadGitIgnoredDebugToken() is a placeholder for your custom helper (e.g., reading from a gitignored plist)
if let debugToken = loadGitIgnoredDebugToken() {
  setenv("AppCheckDebugToken", debugToken, 0)
}
let providerFactory = AppCheckDebugProviderFactory()
AppCheck.setAppCheckProviderFactory(providerFactory)
#endif

FirebaseApp.configure() // Configure Firebase AFTER setting the App Check provider factory
```
