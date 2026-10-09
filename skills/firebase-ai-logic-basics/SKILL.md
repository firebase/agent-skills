---
name: firebase-ai-logic-basics
description: Official skill for integrating Firebase AI Logic (Gemini API) into web applications. Covers setup, multimodal inference, structured output, and security.
metadata:
  author: Google LLC
  category: AiAndMachineLearning
---

# Firebase AI Logic Basics

## Overview

Firebase AI Logic is a product of Firebase that allows developers to add gen AI
to their mobile and web apps using client-side SDKs. You can call Gemini models
directly from your app without managing a dedicated backend. Firebase AI Logic,
which was previously known as "Vertex AI for Firebase", represents the evolution
of Google's AI integration platform for mobile and web developers.

It supports the two Gemini API providers:

- **Gemini Developer API**: It has a free tier ideal for prototyping, and
  pay-as-you-go for production
- **Agent Platform Gemini API** (formerly branded Vertex AI): Ideal for scale
  with enterprise-grade production readiness, requires Blaze plan

Use the Gemini Developer API as a default, and only Agent Platform Gemini API
(formerly branded Vertex AI) if the application requires it.

## Setup & Initialization

### Prerequisites

- Before starting, ensure you have **Node.js 16+** and npm installed. Install
  them if they aren’t already available.
- Identify the platform the user is interested in building on prior to starting:
  Android, iOS, Flutter or Web.
- If their platform is unsupported, Direct the user to Firebase Docs to learn
  how to set up AI Logic for their application (share this link with the user
  https://firebase.google.com/docs/ai-logic/get-started)

### Installation

The library is part of the standard Firebase Web SDK.

`npm install firebase@latest`

If you're in a firebase directory (with a firebase.json) the currently selected
project will be marked with "current" using this command:

`npx -y firebase-tools@latest projects:list`

Ensure there's at least one app associated with the current project

`npx -y firebase-tools@latest apps:list`

Initialize AI logic SDK with the init command

`npx -y firebase-tools@latest init ailogic`

This will automatically enable the Gemini Developer API in the Firebase console.

More info in
[Firebase AI Logic Getting Started](https://firebase.google.com/docs/ai-logic/get-started.md.txt)

## Core Capabilities

> [!WARNING] **CRITICAL: Use current model names:** Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported model names. Do NOT use `gemini-2.0-pro` or
> `gemini-2.0-flash` or other older models that are shutdown.

### Text-Only Generation

### Multimodal (Text + Images/Audio/Video/PDF input)

Firebase AI Logic allows Gemini models to analyze image files directly from your
app. This enables features like creating captions, answering questions about
images, detecting objects, and categorizing images. Beyond images, Gemini can
analyze other media types like audio, video, and PDFs by passing them as inline
data with their MIME type. For files larger than 20 megabytes (which can cause
HTTP 413 errors as inline data), store them in Cloud Storage for Firebase and
pass their URLs to the Gemini Developer API.

### Chat Session (Multi-turn)

Maintain history automatically using `startChat`.

### Streaming Responses

To improve the user experience by showing partial results as they arrive (like a
typing effect), use `generateContentStream` instead of `generateContent` for
faster display of results.

### Text-to-Speech (TTS) Generation

Generate spoken audio directly on client devices without a custom speech
backend. Firebase AI Logic supports speech synthesis using dedicated Gemini TTS
models:

- **Supported Models**: `gemini-3.1-flash-tts-preview`
- **Capabilities**:
  - Single-speaker voice persona selection (`voiceName`) and multi-speaker
    dialogues (up to 2 distinct speakers) via `SpeechConfig` /
    `MultiSpeakerVoiceConfig`
  - Direct audio responses via `responseModalities: [.audio]` / `["AUDIO"]`
  - Streaming speech responses with `generateContentStream` for low-latency
    playback
  - Audio directives (`[Audio Profile: ...]`, `[Scene: ...]`,
    `[Director's Note: ...]`) and emotional tags (`[whispers]`, `[laughs]`,
    `[slowly]`)
  - Client-side decoding of 24 kHz 16-bit linear PCM (`audio/l16`) via
    `AVAudioEngine` (iOS) / `AudioTrack` (Android) or WAV container format
    (`audio/x-wav`) via `AVAudioPlayer` (iOS) / `MediaPlayer` (Android)

See the [Text-to-Speech (TTS) Generation Guide](references/tts_generation.md)
for full implementation details, streaming patterns, and copy-paste code
snippets for iOS (Swift), Android (Kotlin), and Web.

### Generate Images with Nano Banana

> [!WARNING] **Use current Image model names:** Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported image generation (Nano Banana) model names.

- Requires an upgraded Blaze pay-as-you-go billing plan.

### Search Grounding with the built in googleSearch tool

## Supported Platforms and Frameworks

Supported Platforms and Frameworks include Kotlin and Java for Android, Swift
for iOS, JavaScript for web apps, Dart for Flutter, and C Sharp for Unity.

## Advanced Features

### Structured Output (JSON)

Enforce a specific JSON schema for the response.

### On-Device AI (Hybrid)

Hybrid on-device inference for web apps, where the Firebase Javascript SDK
automatically checks for Gemini Nano's availability (after installation) and
switches between on-device or cloud-hosted prompt execution. This requires
specific steps to enable model usage in the Chrome browser, more info in the
[hybrid-on-device-inference documentation](https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference.md.txt).

## Security & Production

### App Check

> [!WARNING] **Critical Safety Requirement:** In order to use AI Logic safely,
> you MUST set up App Check on your app. This prevents unauthorized clients from
> using your API quota and accessing your backend resources.

See
[App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider.md.txt)
for setup instructions.

#### App Check Debug Tokens for Local Development & CI/CD

Because App Check attestation providers (like Play Integrity or DeviceCheck)
reject emulators, simulators, or CI environments, you must use **App Check Debug
Tokens** during development and testing to bypass standard attestation.

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** App Check debug
> tokens allow clients to bypass attestation and access backend resources
> without a genuine device. Treat them as private secrets. **Never commit debug
> tokens to version control or hardcode raw token strings in client code** (Web,
> Android, iOS, or Flutter). Always inject them through local environment
> variables, gitignored local configurations, or CI secrets. If a token is
> compromised, revoke it immediately in the Firebase Console.

##### Local Development (Auto-Generated)

1. Configure your code's App Check provider to use the debug factory:
   - **Web**: Set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` before
     initializing App Check (generates a token in the browser console; do not
     hardcode secret strings in client code).
   - **Android**: Install `DebugAppCheckProviderFactory.getInstance()`.
   - **iOS**: Set provider factory to `AppCheckDebugProviderFactory()`.
1. Run your app in the emulator/localhost.
1. Look at your runtime debugger console / Logcat logs for the generated UUID:
   - *Example:* `AppCheck debug token: "123a4567-b89c-12d3-e456-789012345678"`
1. Register this token in the Firebase Console under **Security > App Check >
   Apps > Manage debug tokens**.

> **💡 iOS Tip (Prevent Debug Token Churn):** On iOS, simulator resets or fresh
> installs erase `NSUserDefaults`, causing the SDK to generate a new debug token
> UUID each time and invalidating tokens registered in the Firebase console. To
> persist a stable debug token without hardcoding secrets, set the
> `AppCheckDebugToken` environment variable in your unshared Xcode Scheme
> (**Edit Scheme -> Run -> Arguments -> Environment Variables -> Add
> `AppCheckDebugToken = <YOUR_DEBUG_TOKEN>`**). The iOS SDK automatically reads
> this environment variable at runtime. If setting it programmatically, load it
> dynamically from a gitignored local file rather than hardcoding the token
> literal into source code.
>
> **💡 Web Tip (Prevent Debug Token Churn):** Clearing site data, using
> incognito/private windows, or switching browsers generates a new debug token
> when `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` is used. To persist a stable
> debug token without leaking secrets into client bundles, load it from a
> gitignored local environment file (e.g., using
> `process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` for Next.js or
> `import.meta.env.VITE_APPCHECK_DEBUG_TOKEN` for Vite). Never hardcode literal
> token strings into JavaScript or TypeScript source files.
>
> **💡 Android Tip (Prevent Debug Token Churn):** Emulator resets or clearing app
> storage erase `SharedPreferences`, causing `DebugAppCheckProviderFactory` to
> print a new debug token in Logcat. To keep a stable debug token across test
> runs and builds without committing it to git, store it in gitignored
> `local.properties` and inject it in `build.gradle.kts` if non-empty:
> `if (appCheckDebugToken.isNotEmpty()) { testInstrumentationRunnerArguments["firebaseAppCheckDebugSecret"] = appCheckDebugToken }`.

##### CI/CD Pipelines (Pre-Provisioned)

1. Generate and register a new debug token in the Firebase Console under
   **Security > App Check > Apps > Manage debug tokens**.
1. Add this token string as an encrypted secret in your CI system (e.g.
   `APP_CHECK_DEBUG_TOKEN`).
1. Configure your build to pass this secret as an environment variable to the
   SDK during test execution (e.g.
   `self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.APP_CHECK_DEBUG_TOKEN`).

### Remote Config

Consider that you do not need to hardcode model names (e.g., a specific model
version string). Use Firebase Remote Config to update model versions dynamically
without deploying new client code. See
[Changing model names remotely](https://firebase.google.com/docs/ai-logic/change-model-name-remotely.md.txt)

> [!WARNING] **CRITICAL: Backend Provisioning Required** For all platforms
> (Flutter, Android, iOS, Web), you MUST run `npx firebase-tools init ailogic`
> to provision the service. `flutterfire configure` ONLY handles client
> configuration and does NOT enable the AI service, leading to
> `PERMISSION_DENIED` errors.

## Initialization Code References

- **Web Modular API**
  - Provider: Gemini Developer API
  - Reference: [usage_patterns_web.md](references/usage_patterns_web.md)
- **Android (Kotlin)**
  - Provider: Gemini Developer API
  - Reference: [usage_patterns_android.md](references/usage_patterns_android.md)
- **iOS (Swift)**
  - Provider: Gemini Developer API
  - Reference: [ios_setup.md](references/ios_setup.md)
- **Flutter (Dart)**
  - Provider: Gemini Developer API
  - Reference: [flutter_setup.md](references/flutter_setup.md)

> [!WARNING] **CRITICAL: Use current model names:** Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported model names. Do NOT use `gemini-2.0-pro` or
> `gemini-2.0-flash` or other older models that are shutdown.

## References

[Web SDK code examples and usage patterns](references/usage_patterns_web.md)
[iOS SDK code examples and usage patterns](references/ios_setup.md)
[Flutter SDK code examples and usage patterns](references/flutter_setup.md)

[Android (Kotlin) SDK usage patterns](references/usage_patterns_android.md)
[Client-side Text-to-Speech (TTS) generation](references/tts_generation.md)
