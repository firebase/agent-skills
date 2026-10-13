# Firebase AI Logic iOS Setup Guide

First, ensure you have initialized the Firebase App and added
`GoogleService-Info.plist` (see `firebase-basics` skill).

## 1. Import and Initialize

Ensure you have installed the `FirebaseAILogic` SDK via Swift Package Manager.
Use the `xcode-project-setup` skill to automate adding the SPM dependency to the
Xcode project.

> [!NOTE] **Renamed SDK.** Firebase AI Logic was formerly "Vertex AI in
> Firebase". The current library is the `FirebaseAILogic` product of the
> Firebase package (introduced in v12.5.0; in v13.0.0+ the interim `FirebaseAI`
> product/module and `Backend.vertexAI()` were removed), imported with
> `import FirebaseAILogic`, with the `FirebaseAI.firebaseAI(backend:)` entry
> point. If the app still links `FirebaseVertexAI` or `FirebaseAI`, or calls
> `VertexAI.vertexAI()`, migrate it; do not generate new code against the old
> library. See the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

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

`.googleAI()` selects the Gemini Developer API (the default). For the Agent
Platform Gemini API use `backend: .agentPlatform()` (optionally
`.agentPlatform(location: "global")`; `"global"` is the default location, and
`.vertexAI()` was removed in v13.0.0).

### App Check Enforcement and Replay Protection

Firebase AI Logic requires Firebase App Check for commonly abused models. If App
Check is not configured in your app and enforced in the Firebase console,
requests to those models fail with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

In addition, when **replay protection** is enabled in App Check, initialize
`FirebaseAI` with `useLimitedUseAppCheckTokens: true`:

```swift
let ai = FirebaseAI.firebaseAI(
    backend: .googleAI(),
    useLimitedUseAppCheckTokens: true
)
```

This ensures the SDK fetches a fresh, single-use (5-minute TTL) App Check token
for each request rather than reusing a standard cached App Check token.

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
    @ObservationIgnored
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

## 3. App Check Debug Provider

For App Check debug tokens during local development and CI/CD, add the
`FirebaseAppCheck` product to the app target (with the `xcode-project-setup`
skill), then set the debug provider factory in debug builds *before*
`FirebaseApp.configure()`. Otherwise the debug provider isn't used.

```swift
import FirebaseAppCheck
import FirebaseCore

// In your app's init(), before configuring Firebase:
#if DEBUG
AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
#else
AppCheck.setAppCheckProviderFactory(AppAttestProviderFactory()) // or DeviceCheckProviderFactory() fallback
#endif
FirebaseApp.configure()
```

For CI/CD, add an `AppCheckDebugToken` environment variable to the Xcode test
scheme with a value like `$(APP_CHECK_DEBUG_TOKEN)`, then pass the token from
the CI test command:

```bash
xcodebuild test -scheme <scheme> -workspace <project>.xcworkspace \
  APP_CHECK_DEBUG_TOKEN=<token>
```

### Debug Token Persistence

When running on simulators or during development, the Firebase iOS SDK stores
its generated debug token in the Keychain and generates a new UUID whenever the
simulator is erased or reset. To avoid invalidating tokens registered in the
Firebase Console and prevent token churn, persist a stable token by setting the
`AppCheckDebugToken` environment variable, which the SDK reads automatically at
runtime (the legacy `FIRAAppCheckDebugToken` alias is also supported):

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
  _ = setenv("AppCheckDebugToken", debugToken, 1)
}
let providerFactory = AppCheckDebugProviderFactory()
#else
let providerFactory = AppAttestProviderFactory()
#endif
AppCheck.setAppCheckProviderFactory(providerFactory)

FirebaseApp.configure() // Configure Firebase AFTER setting the App Check provider factory
```
