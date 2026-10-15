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

> [!NOTE] **Renamed SDK.** Firebase AI Logic was formerly "Vertex AI in
> Firebase". The package `firebase_vertexai` has been replaced by `firebase_ai`.
> Always use `firebase_ai` for new projects (`FirebaseAI.googleAI()` for the
> Gemini Developer API or `FirebaseAI.agentPlatform()` for the Agent Platform
> Gemini API; `FirebaseAI.vertexAI()` and the `auth:` / `appCheck:` parameters
> were deprecated in `firebase_ai` v3.15.0 / v4.0.0 and removed on `main`). See
> the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

## Installation

Add the necessary Firebase dependencies to your `pubspec.yaml` (or run
`flutter pub add firebase_core firebase_auth firebase_app_check firebase_ai`):

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^4.0.0
  firebase_auth: ^6.0.0
  firebase_app_check: ^0.4.0
  firebase_ai: ^4.0.0
```

Run `flutter pub get` to install the packages. Always add `firebase_auth` and
`firebase_app_check` alongside `firebase_ai`: the SDK picks up
`FirebaseAuth.instance` and `FirebaseAppCheck.instance` automatically from the
`FirebaseApp`, and App Check is required for commonly abused models (see
[App Check Debug Provider](#app-check-debug-provider) below).

## Initialization

Initialize Firebase before using AI Logic.

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_ai/firebase_ai.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MyApp());
}
```

## Usage

Use `FirebaseAI.googleAI` for the **Gemini Developer API**.

> [!IMPORTANT] **Model Selection:** Always actively fetch or read
> [Firebase AI Logic Models](https://firebase.google.com/docs/ai-logic/models.md.txt)
> to determine the latest supported Gemini model ID before writing code. Do NOT
> guess model names from memory or use retired/deprecated Gemini 1.x or 2.x
> models (such as `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.0-pro`, or
> `gemini-2.5-flash`).

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

Future<String> generateText(String prompt) async {
  // Always pass useLimitedUseAppCheckTokens: true on the first FirebaseAI.googleAI()
  // call for a FirebaseApp (the SDK caches the instance per app and backend).
  final googleAI = FirebaseAI.googleAI(
    useLimitedUseAppCheckTokens: true,
  );
  
  // [AGENT] Replace '<latest_supported_model>' with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
  final model = googleAI.generativeModel(model: '<latest_supported_model>');

  final response = await model.generateContent([Content.text(prompt)]);
  return response.text ?? 'No response';
}
```

`FirebaseAI.googleAI()` selects the Gemini Developer API (the default). For the
Agent Platform Gemini API use `FirebaseAI.agentPlatform()` (optionally
`FirebaseAI.agentPlatform(location: 'global')`; 'global' is the default
location, and `FirebaseAI.vertexAI()` was deprecated in `v3.15.0` / `v4.0.0` and
removed on `main`).

## App Check Debug Provider

For App Check debug tokens during local development and CI/CD, activate the
debug providers right after `Firebase.initializeApp()` (the `firebase_app_check`
plugin is already added in [Installation](#installation)):

```dart
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';

// In main(), after `await Firebase.initializeApp();`
await FirebaseAppCheck.instance.activate(
  providerAndroid: kDebugMode
      ? const AndroidDebugProvider()
      : const AndroidPlayIntegrityProvider(),
  providerApple: kDebugMode
      ? const AppleDebugProvider()
      : const AppleAppAttestProvider(),
  providerWeb: kDebugMode
      ? WebDebugProvider()
      : ReCaptchaEnterpriseProvider('recaptcha-enterprise-site-key'),
);
```

- Use `providerAndroid`, `providerApple`, and `providerWeb`. The older
  `androidProvider` and `appleProvider` parameters (`AndroidProvider.debug`,
  `AppleProvider.debug`) still appear in many examples but are deprecated.
- Only use the debug providers in debug builds, as gated by `kDebugMode` above.
  Release builds must activate the production providers (Play Integrity, App
  Attest or DeviceCheck, and reCAPTCHA Enterprise) instead; see
  [App Check for Firebase AI Logic](https://firebase.google.com/docs/ai-logic/app-check.md.txt).
- **App Check enforcement and replay protection**: Firebase AI Logic requires
  App Check for commonly abused models (returning
  `HTTP 403: "To access this model, you must enforce Firebase App Check"` if App
  Check is not configured and enforced). When **replay protection** is enabled,
  pass `useLimitedUseAppCheckTokens: true` on the very first
  `FirebaseAI.googleAI(...)` (or `FirebaseAI.agentPlatform(...)`) call for a
  `FirebaseApp` so the SDK fetches single-use (5-minute TTL) tokens.
- **CI/CD**: Pass the pre-provisioned token to all three debug providers, e.g.
  `debugToken: const String.fromEnvironment('APP_CHECK_DEBUG_TOKEN')`, and build
  with `--dart-define=APP_CHECK_DEBUG_TOKEN=<token>`.
- **Flutter web**: `providerWeb` is required on web; without it, `activate()`
  throws. `WebDebugProvider` turns on the web debug token itself, so
  `web/index.html` doesn't need `self.FIREBASE_APPCHECK_DEBUG_TOKEN`.
- If the app uses `firebase_ai` 3.11.0 or lower, also set the `appCheck`
  parameter of `FirebaseAI.googleAI(...)` to `FirebaseAppCheck.instance`. Newer
  versions retrieve `FirebaseAppCheck` and `FirebaseAuth` automatically from
  `FirebaseApp` (`appCheck:` and `auth:` were deprecated in v3.15.0 / v4.0.0,
  omitted on `FirebaseAI.agentPlatform()`, and removed on `main`).
