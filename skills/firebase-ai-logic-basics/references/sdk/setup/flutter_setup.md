# Flutter Setup for Firebase AI Logic

This guide covers how to integrate Firebase AI Logic (Gemini API) into your
Flutter applications.

> [!IMPORTANT] **Foundational Workflows & CLI-First Approach:**
>
> 1. **Review Foundation:** Before implementing platform-specific code, ALWAYS
>    review the foundational `firebase-basics` skill to ensure familiarity with
>    core workflows.
> 1. **Backend Provisioning via CLI:** Use the Firebase CLI for backend setup.
>    Running `npx firebase-tools init ailogic` is MANDATORY to provision the
>    service. `flutterfire configure` does NOT enable the AI service and will
>    result in `PERMISSION_DENIED` if skipped.
> 1. **Client Configuration:** Use `flutterfire configure` strictly for
>    generating `firebase_options.dart`. Avoid manual Console configuration.

> [!NOTE] `firebase_vertexai` has been replaced by `firebase_ai`. Always use
> `firebase_ai` for new projects.

## Installation

Add the necessary Firebase dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^4.0.0
  firebase_auth: ^6.0.0
  firebase_ai: ^3.0.0
```

Run `flutter pub get` to install the packages.

## Initialization

Initialize Firebase and sign in (anonymously or via authenticated user) before
using AI Logic.

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_ai/firebase_ai.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await FirebaseAuth.instance.signInAnonymously();
  runApp(const MyApp());
}
```

## Usage

Use `FirebaseAI.googleAI` for the **Gemini Developer API**.

> [!IMPORTANT] **Model Selection:** Refer to
> [Firebase AI Logic Models](https://firebase.google.com/docs/ai-logic/models.md.txt)
> to find the latest supported model. Do not use old models like
> `gemini-2.0-pro` or `gemini-2.0-flash`.

> [!IMPORTANT] **Choose the Right API Provider:** Always use
> `FirebaseAI.googleAI` (Gemini Developer API) as the default for prototyping
> and standard use. Avoid using the Agent Platform Gemini API (formerly branded
> Vertex AI) unless the app and business use case specifically require
> enterprise-grade scalability or data residency requirements. Note that the
> Gemini Developer API *usually does not* require the Firebase project to be on
> the pay-as-you-go Blaze pricing plan; however, the Agent Platform Gemini API
> does require the Blaze plan.

### Text Generation

```dart
import 'package:firebase_ai/firebase_ai.dart';
import 'package:firebase_auth/firebase_auth.dart';

Future<String> generateText(String prompt) async {
  final googleAI = FirebaseAI.googleAI(auth: FirebaseAuth.instance);
  
  // [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  final model = googleAI.generativeModel(model: '<latest_supported_model>');

  final response = await model.generateContent([Content.text(prompt)]);
  return response.text ?? 'No response';
}
```

### Chat Session

```dart
final chat = model.startChat(history: [
  Content.text('Hello, I am a user.'),
  Content.model([TextPart('Hello! How can I help you today?')]),
]);

final response = await chat.sendMessage(Content.text('What is CBT?'));
```

## App Check Debug Provider

For App Check debug tokens during local development and CI/CD, add the plugin
with `flutter pub add firebase_app_check`, then activate the debug providers
right after `Firebase.initializeApp()`:

```dart
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';

// In main(), after `await Firebase.initializeApp();`
if (kDebugMode) {
  await FirebaseAppCheck.instance.activate(
    providerAndroid: const AndroidDebugProvider(),
    providerApple: const AppleDebugProvider(),
    providerWeb: WebDebugProvider(),
  );
}
```

- Use `providerAndroid`, `providerApple`, and `providerWeb`. The older
  `androidProvider` and `appleProvider` parameters (`AndroidProvider.debug`,
  `AppleProvider.debug`) still appear in many examples but are deprecated.
- Only use the debug providers in debug builds, as gated by `kDebugMode` above.
  Release builds must activate the production providers (Play Integrity, App
  Attest or DeviceCheck, and reCAPTCHA Enterprise) instead; see
  [App Check for Firebase AI Logic](https://firebase.google.com/docs/ai-logic/app-check.md.txt).
- **CI/CD**: Pass the pre-provisioned token to all three debug providers, e.g.
  `debugToken: const String.fromEnvironment('APP_CHECK_DEBUG_TOKEN')`, and build
  with `--dart-define=APP_CHECK_DEBUG_TOKEN=<token>`.
- **Flutter web**: `providerWeb` is required on web; without it, `activate()`
  throws. `WebDebugProvider` turns on the web debug token itself, so
  `web/index.html` doesn't need `self.FIREBASE_APPCHECK_DEBUG_TOKEN`.
- If the app uses `firebase_ai` 3.11.0 or lower, also set the `appCheck`
  parameter of `FirebaseAI.googleAI(...)` to `FirebaseAppCheck.instance`. Newer
  versions don't need this.
