# Firebase AI Logic Flutter Setup Guide

This guide covers installing and initializing the Firebase AI Logic SDK
(`firebase_ai`) in a Flutter app, and wiring up App Check. Once the SDK is
initialized, use the capability guides listed in `SKILL.md` (text generation,
chat, streaming, multimodal input, structured output, and so on) for usage
patterns.

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
> Firebase". The current package is `firebase_ai` with the
> `FirebaseAI.googleAI()` entry point. If the app still depends on
> `firebase_vertexai` or calls `FirebaseVertexAI.instance`, migrate it
> (`flutter pub add firebase_ai`, then `flutter pub remove firebase_vertexai`);
> do not generate new code against the old package. See the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

## 1. Installation

Add the Firebase packages from the Flutter project directory so `pubspec.yaml`
resolves to the latest compatible versions:

```bash
# [AGENT] Do not pin versions copied from examples; let pub resolve the current releases.
flutter pub add firebase_core firebase_ai
```

`firebase_core` and `firebase_ai` are required. `flutter pub add` runs
`flutter pub get` for you; run `flutter pub get` again if you edit
`pubspec.yaml` by hand. Firebase Auth is optional: if the app already uses
`firebase_auth`, `firebase_ai` picks up `FirebaseAuth.instance` from the app
automatically and attaches the signed-in user's token to requests, so no `auth:`
parameter or sign-in step is needed here.

## 2. Initialization

Initialize Firebase before using AI Logic.

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_ai/firebase_ai.dart';
import 'package:flutter/material.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const MyApp());
}
```

## 3. Create a Model and Verify the Setup

Use `FirebaseAI.googleAI()` for the **Gemini Developer API** (the default) and
`FirebaseAI.agentPlatform()` (optionally `agentPlatform(location: 'global')`)
for the **Agent Platform Gemini API**.

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

Verify the setup with a single text-only call:

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

## 4. App Check

### Add and Activate App Check

Install the plugin and activate App Check with a production attestation provider
for each platform the app targets, **after** `Firebase.initializeApp()` and
**before** any AI Logic call:

```bash
flutter pub add firebase_app_check
```

```dart
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await FirebaseAppCheck.instance.activate(
    // Android: Play Integrity (production) or AndroidDebugProvider() (development)
    providerAndroid: const AndroidPlayIntegrityProvider(),
    // iOS/macOS: AppleAppAttestProvider(), AppleDeviceCheckProvider(),
    // AppleAppAttestWithDeviceCheckFallbackProvider(), or AppleDebugProvider() (development)
    providerApple: const AppleAppAttestProvider(),
    // Web: reCAPTCHA Enterprise (recommended) or ReCaptchaV3Provider
    providerWeb: ReCaptchaEnterpriseProvider('recaptcha-enterprise-site-key'),
  );
  runApp(const MyApp());
}
```

Register each platform app with its provider in the Firebase console under
**Security > App Check > Apps**; Flutter apps use the provider of the underlying
platform. On web, `providerWeb` is required: there is no default, and
`activate()` fails without it. Use `providerAndroid`, `providerApple`, and
`providerWeb`; the older `androidProvider`, `appleProvider`, and `webProvider`
parameters (with `AndroidProvider.*` / `AppleProvider.*` enums) still appear in
many examples but are deprecated.

### Replay Protection (Limited-Use Tokens)

Generative and preview models enforce replay protection with 5-minute
limited-use App Check tokens. If you call a protected model without enabling
limited-use tokens, the request fails with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

To resolve this error, pass `useLimitedUseAppCheckTokens: true` when first
creating the `FirebaseAI` instance (because `FirebaseAI.googleAI` and
`FirebaseAI.agentPlatform` cache instances per `FirebaseApp` and backend without
keying on `useLimitedUseAppCheckTokens`, always pass `true` on the very first
call):

```dart
final googleAI = FirebaseAI.googleAI(
  useLimitedUseAppCheckTokens: true,
);
```

This ensures the SDK requests a fresh, short-lived limited-use token for each
request instead of reusing a cached session token. Replay protection needs
recent plugin versions; check the minimum-versions table in the
[App Check for AI Logic guide](https://firebase.google.com/docs/ai-logic/app-check.md.txt).
From `firebase_ai` v3.12.0+ the SDK picks up `FirebaseAppCheck.instance` and
`FirebaseAuth.instance` automatically; in v4.0.0+, the `appCheck:` and `auth:`
parameters and `FirebaseAI.vertexAI()` were removed, so do not pass them in new
code (only apps pinned to v3.11.0 or lower required
`appCheck: FirebaseAppCheck.instance`).

### Debug Providers and Debug Tokens

Emulators, simulators, and CI environments are rejected by production
attestation providers. In debug builds only, activate the debug providers
instead. Each debug provider takes an optional `debugToken`: leave it `null` to
let the SDK generate one, or pass a pre-provisioned token at build time so the
same token survives emulator resets, cleared browser data, and fresh installs:

```dart
import 'package:flutter/foundation.dart' show kDebugMode;

// Optional stable token: flutter run --dart-define=APP_CHECK_DEBUG_TOKEN=<token>
// (locally from a gitignored file, in CI from a secret). Never commit the value.
const debugToken = String.fromEnvironment('APP_CHECK_DEBUG_TOKEN');
final String? stableDebugToken = debugToken.isEmpty ? null : debugToken;

await FirebaseAppCheck.instance.activate(
  providerAndroid: kDebugMode
      ? AndroidDebugProvider(debugToken: stableDebugToken)
      : const AndroidPlayIntegrityProvider(),
  providerApple: kDebugMode
      ? AppleDebugProvider(debugToken: stableDebugToken)
      : const AppleAppAttestProvider(),
  providerWeb: kDebugMode
      ? WebDebugProvider(debugToken: stableDebugToken)
      : ReCaptchaEnterpriseProvider('recaptcha-enterprise-site-key'),
);
```

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Never hardcode
> debug token strings in Dart source, `web/index.html`, Gradle files, or shared
> Xcode schemes. Pass them with `--dart-define` from a gitignored local file or
> a CI secret.

Without a pre-provisioned token, run the app once, copy the generated token from
the logs, and register it in the Firebase console under **Security > App Check >
Apps > Manage debug tokens**:

- **Android**: printed to logcat by `DebugAppCheckProvider` as
  `Firebase App Check debug token: ...`.
- **iOS**: printed to the Xcode console as `Firebase App Check Debug Token: ...`
  (the SDK's own log line also appears if `-FIRDebugEnabled` is added under
  **Product > Scheme > Edit Scheme > Run > Arguments Passed on Launch**).
- **Web**: printed to the browser console; `WebDebugProvider` sets
  `self.FIREBASE_APPCHECK_DEBUG_TOKEN` for you, so no `web/index.html` change is
  needed. Do **not** add `localhost` to the allowed reCAPTCHA domains instead.

A generated token is tied to the device's storage: register it again after an
emulator or simulator reset, cleared browser data, or a fresh install, or pass a
stable one as shown above. The native mechanisms also still work under Flutter
(iOS: the `AppCheckDebugToken` environment variable on an unshared Runner
scheme; Web: `self.FIREBASE_APPCHECK_DEBUG_TOKEN = '<token>'` in
`web/index.html`), but `--dart-define` keeps a single, uncommitted path for all
three platforms.

## Next Steps

The SDK is now ready. Pick the capability guide that matches the feature you are
building from the **SDK Usage** table in `SKILL.md`; every guide has a Flutter
(Dart) section that builds on the `googleAI` and `model` instances created
above.

Last verified against
https://firebase.google.com/docs/ai-logic/get-started.md.txt,
https://firebase.google.com/docs/ai-logic/app-check.md.txt, and the Firebase SDK
sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk, flutterfire;
`main` branches) on 2026-10-08.
