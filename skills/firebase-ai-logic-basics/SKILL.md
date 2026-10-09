---
name: firebase-ai-logic-basics
description: >-
  Integrates Firebase AI Logic (client-side Gemini API; SDKs `firebase-ai` on Android, `FirebaseAILogic` on iOS, `firebase_ai` on Flutter, `firebase/ai` on Web) into Android, iOS, Flutter, and Web apps. Use when provisioning AI Logic (`init ailogic`), choosing a Gemini API provider or model, enforcing App Check for AI Logic, migrating from "Vertex AI in Firebase" (`firebase-vertexai`, `FirebaseVertexAI`, `FirebaseAI`, `firebase_vertexai`, `firebase/vertexai`), debugging `PERMISSION_DENIED` after `flutterfire configure` or HTTP 403 "To access this model, you must enforce Firebase App Check", or adding text generation, multimodal input (images/audio/video/PDF), multi-turn chat, streaming, structured JSON output, function calling, search grounding, image generation (Nano Banana), or text-to-speech to an app. Don't use for server-side Genkit flows, Firebase Auth, Firestore, Hosting, App Hosting, Data Connect, Crashlytics, or Remote Config template management.
compatibility: This skill is best used with the Firebase CLI, but does not require it. Firebase CLI can be accessed through `npx -y firebase-tools@latest`.
metadata:
  author: Google LLC
  category: AiAndMachineLearning
  version: "1.1.0"
---

# Firebase AI Logic

This skill provides a complete guide for getting started with Firebase AI Logic
on Android, iOS, Flutter, or Web. Firebase AI Logic (formerly "Vertex AI for
Firebase") lets your app call Gemini models directly from client-side Firebase
SDKs, without building or managing a dedicated backend.

Working with AI Logic has two distinct parts, and this skill is organized the
same way:

- **Service Management**: Enabling and operating AI Logic in a Firebase project
  using the Firebase CLI and the Firebase console: provisioning, API provider
  and billing, App Check enforcement, model rollout, and monitoring. This
  involves no app code and is the same for every platform.
- **SDK Setup and Usage**: Adding the Firebase AI Logic client SDK to an
  Android, iOS, Flutter, or Web app and calling Gemini models from app code.

## Prerequisites

Provisioning AI Logic requires both a Firebase project and a Firebase app
(Android, iOS, Flutter, or Web). See the `firebase-basics` skill for project
creation, CLI login, and downloading app config files.

The Firebase CLI commands in this skill run through `npx` on every platform, so
they need Node.js (a current LTS release) and npm. Use the `firebase-basics`
skill to check for them and to log in to the CLI. If Node.js is missing or too
old, ask the user to install it as that skill describes. Never install system
packages yourself (for example with `sudo apt-get`, `brew`, or a global
`npm install -g`), because that changes the user's machine without their
consent.

Before starting, identify the platform the user is building on. This skill
covers Kotlin/Java (Android), Swift (iOS), Dart (Flutter), and JavaScript (Web).
For other supported platforms, such as C# for Unity, direct the user to the
[Firebase AI Logic Getting Started guide](https://firebase.google.com/docs/ai-logic/get-started).

## Core Concepts

### Gemini API Providers

Firebase AI Logic supports two Gemini API providers:

- **Gemini Developer API**: It has a free tier ideal for prototyping, and
  pay-as-you-go for production
- **Agent Platform Gemini API** (formerly branded Vertex AI): Ideal for scale
  with enterprise-grade production readiness, requires Blaze plan

Use the Gemini Developer API as the default. Only use the Agent Platform Gemini
API if the application specifically requires it (for example, enterprise-grade
scalability or data residency requirements).

### Model Selection

> [!WARNING] **CRITICAL: Use current model names.** Always check the
> [Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
> for the currently supported model names, including image generation and
> text-to-speech models. Do NOT use `gemini-2.0-pro`, `gemini-2.0-flash`, or
> other older models that are shut down.

Avoid hardcoding model names in client code. See
[Model Rollout with Remote Config](#4-model-rollout-with-remote-config).

## Service Management

Everything in this section is done with the Firebase CLI or the Firebase
console, applies to all platforms, and must be in place before the SDK will
work.

### 1. Provisioning

If you are in a Firebase directory (with a `firebase.json`), first confirm the
current project and that it has at least one app:

```bash
npx -y firebase-tools@latest projects:list
npx -y firebase-tools@latest apps:list
```

Then provision the service:

```bash
npx -y firebase-tools@latest init ailogic
```

This prompts you to select the Firebase app (Android, iOS, or Web) to enable AI
Logic for, enables the Gemini Developer API in the project, and prints the app's
updated Firebase config file (`google-services.json`,
`GoogleService-Info.plist`, or the web config). Save that config in the app.
More info in
[Firebase AI Logic Getting Started](https://firebase.google.com/docs/ai-logic/get-started.md.txt).

The equivalent console workflow is **AI Services > AI Logic > Get started**,
which also registers the app and enables the required APIs.

> [!WARNING] **CRITICAL: Backend Provisioning Required** For all platforms
> (Android, iOS, Flutter, Web), you MUST run `init ailogic` (or complete the
> console workflow) to provision the service, even if the app already uses other
> Firebase products such as Auth or Firestore. Adding the SDK to your app or
> running `flutterfire configure` ONLY handles client configuration and does NOT
> enable the AI service, leading to `PERMISSION_DENIED` errors. If you cannot
> run `init ailogic` yourself (for example, the CLI is not logged in or the
> environment is non-interactive), tell the user to run it and do not describe
> the setup as complete until they have.

### 2. API Provider and Billing

- `init ailogic` enables the **Gemini Developer API**, which usually does not
  require the Blaze pricing plan. This is the recommended default.
- The **Agent Platform Gemini API** can be set up at any time from the **AI
  Logic** page in the Firebase console. It requires the Blaze plan.
- Some capabilities require the Blaze plan regardless of provider, notably image
  generation (Nano Banana).
- On the Blaze plan, set up budget alerts and spend caps to avoid surprise
  bills. See [pricing](https://firebase.google.com/docs/ai-logic/pricing.md.txt)
  and
  [monitoring costs](https://firebase.google.com/docs/ai-logic/monitoring.md.txt).

### 3. App Check Enforcement

> [!WARNING] **Critical Safety Requirement:** In order to use AI Logic safely,
> you MUST enforce
> [Firebase App Check](https://firebase.google.com/docs/ai-logic/app-check.md.txt)
> for AI Logic. This prevents unauthorized clients from using your API quota and
> accessing your backend resources. App Check enforcement becomes required for
> Firebase AI Logic starting November 2, 2026.

Enforcement is configured in the Firebase console, independent of app code:

1. Go to **Security > App Check > APIs** and find the **Firebase AI Logic** row.
   If it says `Unenforced`, click it and then **Set up**.
1. Under **Baseline protection**, select **Enforced**.
1. **Replay protection** can be enabled on the same screen once your app
   requests limited-use tokens (see
   [App Check in the SDK](#app-check-in-the-sdk)). Generative and preview models
   enforce replay protection with 5-minute limited-use tokens.
1. To release to end users, register each app with a production attestation
   provider: Play Integrity (Android), App Attest or DeviceCheck (iOS), or
   reCAPTCHA Enterprise (Web). Flutter apps use the provider of the underlying
   platform. Registration is not needed while only using the debug provider in
   pre-production.

#### Debug Tokens for Local Development & CI/CD

Because attestation providers reject emulators, simulators, and CI environments,
use **App Check debug tokens** during development and testing to bypass standard
attestation. Tokens are registered in the Firebase Console under **Security >
App Check > Apps > Manage debug tokens**.

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** App Check debug
> tokens allow clients to bypass attestation and access backend resources
> without a genuine device. Treat them as private secrets. **Never commit debug
> tokens to version control or hardcode raw token strings in client code** on
> any platform. Always inject them through local environment variables,
> gitignored local configurations, or CI secrets. If a token is compromised,
> revoke it immediately in the Firebase Console.

- **Local development (auto-generated token)**: Configure the debug provider in
  the app (see [App Check in the SDK](#app-check-in-the-sdk)), run the app, copy
  the generated UUID from the console or logs (for example
  `AppCheck debug token: "123a4567-b89c-12d3-e456-789012345678"`), and register
  it under **Manage debug tokens**.
- **CI/CD pipelines (pre-provisioned token)**: Generate and register a new debug
  token under **Manage debug tokens**, add it as an encrypted secret in your CI
  system (e.g. `APP_CHECK_DEBUG_TOKEN`), and configure the build to pass it to
  the SDK as an environment variable during test execution.

### 4. Model Rollout with Remote Config

Do not hardcode model version strings in client code. Use Firebase Remote Config
to update model names dynamically without deploying new client code. See
[Changing model names remotely](https://firebase.google.com/docs/ai-logic/change-model-name-remotely.md.txt)
and the `firebase-remote-config-basics` skill for managing the template.

### 5. Monitoring

Enable **AI monitoring** on the **AI Logic** page of the Firebase console to see
request volume, latency, errors, per-modality token usage, and request traces
for each app. Costs appear in the project's **Usage and Billing** dashboard. See
[Monitor costs and usage](https://firebase.google.com/docs/ai-logic/monitoring.md.txt).

## SDK Setup

To add the AI Logic SDK to your application code, choose your platform. Each
guide covers dependencies, initialization with the Gemini Developer API
provider, App Check in the app, and the idiomatic UI pattern for the platform:

- **Android (Kotlin)**:
  [android_setup.md](references/sdk/setup/android_setup.md)
- **iOS (Swift)**: [ios_setup.md](references/sdk/setup/ios_setup.md)
- **Flutter (Dart)**: [flutter_setup.md](references/sdk/setup/flutter_setup.md)
- **Web (JavaScript)**: [web_setup.md](references/sdk/setup/web_setup.md)

## SDK Usage

The SDK provides the same capabilities on every platform. Each capability guide
explains the concept once and then gives Android (Kotlin), iOS (Swift), Flutter
(Dart), and Web (JavaScript) code. Read only the guides the task needs.

| Capability        | Use when                                                                             | Reference                                                                |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Text generation   | A text prompt should produce text; also covers generation config and safety settings | [text_generation.md](references/sdk/capabilities/text_generation.md)     |
| Multimodal input  | Images, audio, video, or PDFs are part of the prompt                                 | [multimodal_input.md](references/sdk/capabilities/multimodal_input.md)   |
| Chat              | Multi-turn conversations with automatically maintained history                       | [chat.md](references/sdk/capabilities/chat.md)                           |
| Streaming         | Partial results should render as they arrive (typing effect)                         | [streaming.md](references/sdk/capabilities/streaming.md)                 |
| Structured output | The response must be JSON matching a schema                                          | [structured_output.md](references/sdk/capabilities/structured_output.md) |
| Function calling  | The model should call app-defined tools (APIs, local data)                           | [function_calling.md](references/sdk/capabilities/function_calling.md)   |
| Search grounding  | Responses must be grounded in current web content                                    | [search_grounding.md](references/sdk/capabilities/search_grounding.md)   |
| Image generation  | Generate or edit images (Nano Banana); requires Blaze                                | [image_generation.md](references/sdk/capabilities/image_generation.md)   |
| Text-to-speech    | Spoken audio generated on the client with Gemini TTS models                          | [text_to_speech.md](references/sdk/capabilities/text_to_speech.md)       |
| On-device hybrid  | Android & Web: prefer on-device Gemini Nano with cloud fallback                      | [on_device_hybrid.md](references/sdk/capabilities/on_device_hybrid.md)   |

Each guide starts with the concept and its configuration, then has one section
per platform. Read the concept section and the user's platform section only;
skip the other platforms' sections, which show the same pattern in another
language.

Across all capabilities: model calls are network requests that can fail or be
blocked, so surface errors and show progress in the UI (the setup guides show
the idiomatic pattern for each platform), and never hardcode model names (see
[Model Selection](#model-selection)).

### App Check in the SDK

The app-side half of [App Check Enforcement](#3-app-check-enforcement). One rule
applies on every platform: pass `useLimitedUseAppCheckTokens` (`true`) when
initializing the AI Logic service so each request carries a fresh limited-use
token. Without it, protected models fail with
`HTTP 403: "To access this model, you must enforce Firebase App Check"`.

Everything else is platform-specific and lives in the *App Check* section of
each setup guide: initializing the production attestation provider, switching to
the debug provider in development builds, and persisting a stable debug token
without committing it (simulator or emulator resets, cleared browser data, and
fresh installs otherwise generate a *new* token and invalidate the one
registered in the console).
