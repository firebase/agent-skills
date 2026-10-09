# Firebase AI Logic iOS Setup Guide

This guide covers installing and initializing the Firebase AI Logic SDK in an
iOS app, the recommended SwiftUI integration pattern, and wiring up App Check.
Once the SDK is initialized, use the capability guides listed in `SKILL.md`
(text generation, chat, function calling, structured output, and so on) for
usage patterns.

Important references:

- Refer to the `firebase-basics` skill, particularly its iOS setup reference,
  before proceeding.
- Refer to the `xcode-project-setup` skill to add the Swift Package dependency.

## 1. Import and Initialize

Ensure you have installed the `FirebaseAILogic` SDK via Swift Package Manager
from the `https://github.com/firebase/firebase-ios-sdk.git` repository.

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

## 2. SwiftUI Integration (Best Practices)

Use the `@Observable` pattern to manage AI state and provide a smooth UX with
loading indicators and error handling. The `generate(prompt:)` call below also
serves as a smoke test that the SDK is configured correctly.

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

## 3. App Check

### Production Provider (App Attest)

Add the `FirebaseAppCheck` product from the same Swift package, then set the
provider factory **before** `FirebaseApp.configure()` (for example in the `App`
initializer or `AppDelegate`):

```swift
import FirebaseAppCheck
import FirebaseCore

#if DEBUG
AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
#else
AppCheck.setAppCheckProviderFactory(AppAttestProviderFactory())
#endif
FirebaseApp.configure()
```

`AppAttestProviderFactory` (available in `firebase-ios-sdk` v12.14.0+) is the
recommended production provider; `DeviceCheckProviderFactory()` is the fallback
for devices or OS versions without App Attest. Register the app with the
matching provider in the Firebase console under **Security > App Check > Apps**.

### Replay Protection

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

### Debug Token Persistence

When running on simulators or during development, the Firebase iOS SDK stores
its generated debug token in the Keychain and generates a new UUID whenever the
simulator is erased or reset. To avoid invalidating tokens registered in the
Firebase Console and prevent token churn, persist a stable token by setting the
`AppCheckDebugToken` environment variable:

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Debug tokens
> grant access to backend resources without device attestation. Never commit
> debug tokens to version control or hardcode token strings in source code.

- **In Xcode Scheme (Recommended):** Edit Scheme -> Run -> Arguments ->
  Environment Variables -> Add `AppCheckDebugToken = <YOUR_DEBUG_TOKEN>`. Keep
  user schemes (`xcuserdata/`) unshared and gitignored.
- **In CI/CD:** In the shared test scheme, set the environment variable's value
  to `$(APP_CHECK_DEBUG_TOKEN)` so no token is stored in the repo, then pass the
  real value from the CI secret on the command line:
  `xcodebuild test -scheme <scheme> -workspace <project>.xcworkspace APP_CHECK_DEBUG_TOKEN=<token>`.
- **In Code (Safe Dynamic Loading Only):** If setting the environment variable
  in code before configuring `AppCheckDebugProviderFactory`, load the token
  dynamically from a gitignored local file or environment rather than hardcoding
  the token literal:

```swift
import FirebaseAppCheck // AppCheck, AppCheckDebugProviderFactory, AppAttestProviderFactory
import FirebaseCore     // FirebaseApp

#if DEBUG
// ✅ SAFE: Load from gitignored local file or process environment
// Note: loadGitIgnoredDebugToken() is a placeholder for your custom helper (e.g., reading from a gitignored plist)
if let debugToken = loadGitIgnoredDebugToken() {
  setenv("AppCheckDebugToken", debugToken, 0)
}
let providerFactory = AppCheckDebugProviderFactory()
#else
let providerFactory = AppAttestProviderFactory()
#endif
AppCheck.setAppCheckProviderFactory(providerFactory)

FirebaseApp.configure() // Configure Firebase AFTER setting the App Check provider factory
```

## Next Steps

The SDK is now ready. Pick the capability guide that matches the feature you are
building from the **SDK Usage** table in `SKILL.md`; every guide has an iOS
(Swift) section that builds on the `ai` and `model` instances created above.

Last verified against
https://firebase.google.com/docs/ai-logic/get-started.md.txt,
https://firebase.google.com/docs/ai-logic/app-check.md.txt, and the Firebase SDK
sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk, flutterfire;
`main` branches) on 2026-10-08.
