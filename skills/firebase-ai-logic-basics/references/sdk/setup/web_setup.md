# Firebase AI Logic Web Setup Guide

This guide covers installing and initializing the Firebase AI Logic SDK in a web
app using the modular JavaScript SDK, and wiring up App Check. Once the SDK is
initialized, use the capability guides listed in `SKILL.md` (text generation,
chat, streaming, multimodal input, structured output, and so on) for usage
patterns.

## Prerequisites

Before working with Firebase AI Logic, use the `firebase-basics` skill and its
`references/web_setup.md` to ensure the following is done:

- The Firebase CLI is available and authenticated.
- A Firebase project exists with a registered Web app.
- AI Logic is provisioned in the project
  (`npx -y firebase-tools@latest init ailogic`).

## 1. Installation

Web development with Firebase needs Node.js (a current LTS release, 20 or newer)
and npm. If `node --version` fails or is older, follow the `firebase-basics`
skill's `references/local-env-setup.md`: ask the user to install it and wait for
confirmation rather than installing it yourself.

The AI Logic library is part of the standard Firebase Web SDK:

```bash
npm install firebase@latest
```

> [!NOTE] **Renamed SDK.** Firebase AI Logic was formerly "Vertex AI in
> Firebase". The current entry point is `firebase/ai` (`getAI`,
> `getGenerativeModel`, `GoogleAIBackend`). If the app still imports from
> `firebase/vertexai` or calls `getVertexAI`, migrate it; do not generate new
> code against the old entry point. See the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

## 2. Initialization

You must initialize the AI Logic service after the main Firebase App.

```JavaScript
import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";


// If running in Firebase App Hosting, you can skip Firebase Config and instead use:
// const app = initializeApp();

const firebaseConfig = {
  // ... your firebase config
};

const app = initializeApp(firebaseConfig);

// Initialize the AI Logic service (defaults to Gemini Developer API)
// Pass useLimitedUseAppCheckTokens: true to enable replay protection:
const ai = getAI(app, {
  backend: new GoogleAIBackend(),
  useLimitedUseAppCheckTokens: true,
});

// Optional generation config. For the latest general-use Gemini models,
// temperature, top-K, top-P, frequency penalty, presence penalty, and candidate
// count are unsupported; see the Text Generation capability guide for details.
const generationConfig = {
  maxOutputTokens: 2048,
  stopSequences: [],
};

// Specify the config as part of creating the `GenerativeModel` instance
// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
const model = getGenerativeModel(ai, { model: "<latest_supported_model>",  generationConfig });
```

`new GoogleAIBackend()` selects the Gemini Developer API (the default). For the
Agent Platform Gemini API use `backend: new AgentPlatformBackend()` (optionally
`new AgentPlatformBackend("us-central1")`; the default location is `global`).

Verify the setup with a single text-only call:

```JavaScript
async function generateText(prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
```

## 3. App Check

### Replay Protection (Limited-Use Tokens)

Generative and preview models enforce replay protection with 5-minute
limited-use App Check tokens. If you call a protected model without enabling
limited-use tokens, the request fails with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

To resolve this error on Web, initialize `getAI` with
`useLimitedUseAppCheckTokens: true`:

```javascript
const ai = getAI(app, {
  backend: new GoogleAIBackend(),
  useLimitedUseAppCheckTokens: true,
});
```

This instructs the SDK to fetch fresh, short-lived limited-use tokens (such as
via reCAPTCHA Enterprise or the debug provider) for requests rather than reusing
standard cached App Check tokens.

### Debug Token Persistence

For local development, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` before
initializing App Check to generate a debug token in the browser console, then
register it in the Firebase Console under **Security > App Check > Apps > Manage
debug tokens**.

Clearing site data, using incognito/private windows, or switching browsers
generates a new debug token. To persist a stable token without leaking secrets
into client bundles, load it from a gitignored local environment file:

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Never hardcode
> debug token strings in web source code. Always load them from a local,
> gitignored environment file.

```javascript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

if (typeof self !== "undefined") {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    // ✅ SAFE: Load dynamically from Next.js environment variable; fallback to true to auto-generate
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN || true;
  } else if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    // ✅ SAFE: Load dynamically from Vite environment variable; fallback to true to auto-generate
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
}

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("/* reCAPTCHA site key */"),
  isTokenAutoRefreshEnabled: true,
});
```

## 4. Usage

### Text-Only Generation

```JavaScript
async function generateText(prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
```

### Multimodal (Text + Images/Audio/Video/PDF input)

Firebase AI Logic accepts Base64 encoded data or specific file references.

```JavaScript
// Helper to convert file to base64 generic object
async function fileToGenerativePart(file) {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
}

async function analyzeImage(prompt, imageFile) {
  const imagePart = await fileToGenerativePart(imageFile);
  const result = await model.generateContent([prompt, imagePart]);
  return result.response.text();
}
```

### Chat Session (Multi-turn)

Maintain history automatically using `startChat`.

```JavaScript
const chat = model.startChat({
  history: [
    {
      role: "user",
      parts: [{ text: "Hello, I am a developer." }],
    },
    {
      role: "model",
      parts: [{ text: "Great to meet you. How can I help with code?" }],
    },
  ],
});

async function sendMessage(msg) {
  const result = await chat.sendMessage(msg);
  return result.response.text();
}
```

### Streaming Responses

For real-time UI updates (like a typing effect).

```JavaScript
async function streamResponse(prompt) {
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    console.log("Stream chunk:", chunkText);
    // Update UI here
  }
}
```

### Generate Images with Nano Banana

Image generation requires an upgraded Blaze pay-as-you-go billing plan. Always
check the
[Firebase AI Logic Models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
for the currently supported image generation (Nano Banana) model names.

```Javascript
import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend, ResponseModality } from "firebase/ai";


// Initialize FirebaseApp
const firebaseApp = initializeApp(firebaseConfig);

// Initialize the Gemini Developer API backend service
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// Create a `GenerativeModel` instance with a model that supports your use case
const model = getGenerativeModel(ai, {
  model: "<latest_supported_image_model>", // [AGENT] Replace with the latest image model from https://firebase.google.com/docs/ai-logic/models.md.txt
  // Configure the model to respond with text and images (required)
  generationConfig: {
    responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE],
  },
});

// Provide a text prompt instructing the model to generate an image
const prompt = 'Generate an image of the Eiffel Tower with fireworks in the background.';

// To generate an image, call `generateContent` with the text input
const result = await model.generateContent(prompt);

// Handle the generated image
try {
  const inlineDataParts = result.response.inlineDataParts();
  if (inlineDataParts?.[0]) {
    const image = inlineDataParts[0].inlineData;
    console.log(image.mimeType, image.data);
  }
} catch (err) {
  console.error('Prompt or candidate was blocked:', err);
}
```

## 5. Advanced Features

### Structured Output (JSON)

Enforce a specific JSON schema for the response.

```JavaScript
import { getGenerativeModel, Schema } from "firebase/ai";
const jsonModel = getGenerativeModel(ai, {
    model: "<latest_supported_model>", // [AGENT] Replace with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
    generationConfig: {
        responseMimeType: "application/json",
        // Optional: Define a schema
        responseSchema: Schema.object({ ... })
    }
});

async function getJsonData(prompt) {
    const result = await jsonModel.generateContent(prompt);
    return JSON.parse(result.response.text());
}
```

### On-Device AI (Hybrid)

Automatically switch between local Gemini Nano and cloud models based on device
capability. The SDK checks for Gemini Nano's availability (after installation)
and switches between on-device or cloud-hosted prompt execution. This requires
specific steps to enable model usage in the Chrome browser; see the
[hybrid on-device inference documentation](https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference.md.txt).

```JavaScript
import {getGenerativeModel, InferenceMode } from "firebase/ai";

const hybridModel = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
```

## Next Steps

The SDK is now ready. Pick the capability guide that matches the feature you are
building from the **SDK Usage** table in `SKILL.md`; every guide has a Web
(JavaScript) section that builds on the `ai` and `model` instances created
above.

Last verified against
https://firebase.google.com/docs/ai-logic/get-started.md.txt,
https://firebase.google.com/docs/ai-logic/app-check.md.txt, and the Firebase SDK
sources (firebase-android-sdk, firebase-ios-sdk, firebase-js-sdk, flutterfire;
`main` branches) on 2026-10-08.
