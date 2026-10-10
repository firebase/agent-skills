---
name: firebase-ai-logic-basics
description: >-
  Integrates Firebase AI Logic (formerly Vertex AI for Firebase) into mobile and web apps (Android, iOS, Web, and Flutter) to call Gemini models from client code. Use when provisioning or initializing Firebase AI Logic, or adding Gemini features to an app: text generation, multimodal input, chat, streaming, structured output, hybrid on-device inference, App Check protection, or switching models with Remote Config.
version: 1.0.1
metadata:
  author: Google LLC
  category: AiAndMachineLearning
---

# Firebase AI Logic Basics

## Overview

Firebase AI Logic is a product of Firebase that allows developers to add gen AI
to their mobile and web apps using client-side SDKs. The app can directly call
Gemini models via Firebase AI Logic without the developer needing to manage a
dedicated backend. Firebase AI Logic was previously known as "Vertex AI for
Firebase".

It supports the two Gemini API providers:

- **Gemini Developer API**: It has a free tier ideal for prototyping, and
  pay-as-you-go for production
- **Agent Platform Gemini API** (formerly branded Vertex AI): Ideal for scale
  with enterprise-grade production readiness, requires Blaze pricing plan

Use the Gemini Developer API as a default, and only Agent Platform Gemini API
(formerly branded Vertex AI) if the application requires it.

______________________________________________________________________

## Setup & initialization

### Prerequisites

- Identify the platform the user is interested in building on prior to starting:
  Android, iOS, Web, or Flutter.
- If their platform is unsupported, Direct the user to Firebase Docs to learn
  how to set up AI Logic for their application (share this link with the user
  https://firebase.google.com/docs/ai-logic/get-started)
- The Firebase CLI commands below run through `npx` on every platform, so they
  need **Node.js 20+** and npm. Use the `firebase-basics` skill to check for
  them and to log in to the Firebase CLI. If Node.js is missing or older than
  version 20, ask the user to install it as that skill describes. Don't install
  system packages yourself, for example with `sudo apt-get`, because that
  changes the user's machine without their consent.

### 1. Provision Firebase AI Logic (ALL platforms)

Use the **Firebase CLI** to provision Firebase AI Logic for the Firebase
Project:

1. Make sure that you're in a firebase directory (with a `firebase.json`).

1. Verify that you're running Firebase CLI commands against the intended
   Firebase Project. When you run this command, the active project is marked
   with "current":

   ```bash
   npx -y firebase-tools@latest projects:list
   ```

1. Make sure there's at least one Firebase App for the target platform
   registered with the current Firebase Project:

   ```bash
   npx -y firebase-tools@latest apps:list
   ```

1. Provision Firebase AI Logic for the Firebase Project:

   ```bash
   npx -y firebase-tools@latest init ailogic
   ```

   This command will enable the Gemini Developer API in the Firebase project.

> [!WARNING] **CRITICAL: Provisioning Firebase AI Logic is Required** For all
> platforms (Android, iOS, Web, or Flutter), even if the app already uses
> Firebase, you MUST run `npx -y firebase-tools@latest init ailogic` to
> provision the service. The configuration files of `GoogleService-Info.plist`,
> `google-services.json`, and `firebase_options.dart` ONLY handle client
> configuration and do NOT enable the Firebase AI Logic service, leading to
> `PERMISSION_DENIED` errors.

If you can't run `init ailogic` yourself (for example because Node.js is missing
or the Firebase CLI isn't logged in) do NOT skip it. The app's requests to
Gemini models will fail until the Firebase AI Logic service is provisioned. Tell
the user to run this command in their project directory, and include it in your
final summary:

```bash
npx -y firebase-tools@latest init ailogic
```

### 2. Add the SDK and initialize the service in the app

Adding the SDK dependency and initializing the service are platform-specific.
Before writing code, read the reference for the target platform listed under
[Initialization Code References](#initialization-code-references).

More info in
[Firebase AI Logic Getting Started](https://firebase.google.com/docs/ai-logic/get-started.md.txt)

______________________________________________________________________

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
  - Direct audio responses by setting `responseModalities` to audio
  - Streaming speech responses with `generateContentStream` for low-latency
    playback
  - Audio directives (`[Audio Profile: ...]`, `[Scene: ...]`,
    `[Director's Note: ...]`) and emotional tags (`[whispers]`, `[laughs]`,
    `[slowly]`)
  - Client-side decoding and playback of 24 kHz 16-bit linear PCM (`audio/l16`)
    or WAV container format (`audio/x-wav`)

See the [Text-to-Speech (TTS) Generation Guide](references/tts_generation.md)
for full implementation details, streaming patterns, and copy-paste code
snippets for iOS (Swift), Android (Kotlin), and Web.

### Generate Images with Nano Banana

> [!WARNING] **Use current Image model names:** Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported image generation (Nano Banana) model names.

- Requires an upgraded Blaze pay-as-you-go billing plan.

### Search Grounding with the built in googleSearch tool

______________________________________________________________________

## Supported Platforms and Frameworks

Supported Platforms and Frameworks include Kotlin and Java for Android, Swift
for iOS, JavaScript for web apps, Dart for Flutter, and C Sharp for Unity.

## Advanced Features

### Structured Output (JSON)

Enforce a specific JSON schema for the response.

### On-Device AI (Hybrid)

Hybrid inference runs prompts with an on-device model when one is available and
falls back to a cloud-hosted model otherwise (or vice versa). Availability and
setup steps differ by platform, more info in the
[hybrid and on-device documentation](https://firebase.google.com/docs/ai-logic/hybrid.md.txt),
which links to each platform's guide.

______________________________________________________________________

## Security & Production

### Firebase App Check

> [!WARNING] **Critical Safety Requirement:** In order to use AI Logic safely,
> you MUST set up App Check on your app. This prevents unauthorized clients from
> using your API quota and accessing your backend resources.

See
[App Check for Firebase AI Logic](https://firebase.google.com/docs/ai-logic/app-check.md.txt)
for setup instructions. Each platform uses its own attestation provider, so
follow the instructions for the target platform.

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

1. Configure your code's App Check provider to use the debug factory. The API is
   platform-specific; see the App Check section of the platform reference or the
   App Check documentation linked above.
1. Run your app in the emulator/localhost.
1. Look at your runtime debugger console / Logcat logs for the generated UUID:
   - *Example:* `AppCheck debug token: "123a4567-b89c-12d3-e456-789012345678"`
1. Register this token in the Firebase Console under **Security > App Check >
   Apps > Manage debug tokens**.

> **💡 Tip (Prevent Debug Token Churn):** Simulator or emulator resets, fresh
> installs, and clearing browser data can make the SDK generate a new debug
> token that you must register again. To keep a stable debug token without
> hardcoding it, see the App Check section of the platform reference.

##### CI/CD Pipelines (Pre-Provisioned)

1. Generate and register a new debug token in the Firebase Console under
   **Security > App Check > Apps > Manage debug tokens**.
1. Add this token string as an encrypted secret in your CI system (e.g.
   `APP_CHECK_DEBUG_TOKEN`).
1. Configure your build to pass this secret as an environment variable to the
   SDK during test execution.

### Firebase Remote Config

Consider that you do not need to hardcode model names (e.g., a specific model
version string). Use Firebase Remote Config to update model versions dynamically
without deploying new client code. See
[Changing model names remotely](https://firebase.google.com/docs/ai-logic/change-model-name-remotely.md.txt)

______________________________________________________________________

## Initialization Code References

- **Android (Kotlin)**

  - Gemini API Provider: Gemini Developer API
  - Reference: [usage_patterns_android.md](references/usage_patterns_android.md)

- **iOS (Swift)**

  - Gemini API Provider: Gemini Developer API
  - Reference: [ios_setup.md](references/ios_setup.md)

- **Web Modular API**

  - Gemini API Provider: Gemini Developer API
  - Reference: [usage_patterns_web.md](references/usage_patterns_web.md)

- **Flutter (Dart)**

  - Gemini API Provider: Gemini Developer API
  - Reference: [flutter_setup.md](references/flutter_setup.md)

> [!WARNING] **CRITICAL: Use current model names:** Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported model names. Do NOT use `gemini-2.0-pro` or
> `gemini-2.0-flash` or other older models that are shutdown.

## References

[Android (Kotlin) SDK usage patterns](references/usage_patterns_android.md)
[iOS SDK code examples and usage patterns](references/ios_setup.md)
[Web SDK setup, code examples, and usage patterns](references/usage_patterns_web.md)

[Flutter SDK code examples and usage patterns](references/flutter_setup.md)
[Client-side Text-to-Speech (TTS) generation](references/tts_generation.md)
