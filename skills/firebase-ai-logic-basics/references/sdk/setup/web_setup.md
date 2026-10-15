# Firebase AI Logic on Web (JavaScript)

## Installation

The library is part of the standard Firebase Web SDK (`firebase@13.0.0+`
requires Node.js `>=24.12.0`):

```bash
npm install firebase@latest
```

> [!NOTE] **Renamed SDK.** Firebase AI Logic was formerly "Vertex AI in
> Firebase". The current entry point is `firebase/ai` (`getAI`,
> `getGenerativeModel`, `GoogleAIBackend`, `AgentPlatformBackend`). If the app
> still imports from `firebase/vertexai`, calls `getVertexAI`, or uses
> `VertexAIBackend` (removed in `firebase@13.0.0` / `@firebase/ai@3.0.0`),
> migrate it; do not generate new code against the old entry point. See the
> [migration guide](https://firebase.google.com/docs/ai-logic/migrate-to-latest-sdk.md.txt).

## Initialization Pattern

First, ensure you have initialized the Firebase App (see `firebase-basics`
skill). Then, initialize the AI Logic service as below:

```javascript
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

// [AGENT] Replace "<latest_supported_model>" with the latest model from https://firebase.google.com/docs/ai-logic/models.md.txt
const model = getGenerativeModel(ai, { model: "<latest_supported_model>" });
```

`new GoogleAIBackend()` selects the Gemini Developer API (the default). For the
Agent Platform Gemini API use `backend: new AgentPlatformBackend()` (optionally
`new AgentPlatformBackend("us-central1")`; the default location is `global`, and
`VertexAIBackend` was removed in `firebase@13.0.0`).

### App Check Enforcement and Replay Protection

Firebase AI Logic requires Firebase App Check for commonly abused models. If App
Check is not configured in your app and enforced in the Firebase console,
requests to those models fail with:

```text
HTTP 403: "To access this model, you must enforce Firebase App Check"
```

In addition, when **replay protection** is enabled in App Check, initialize
`getAI` with `useLimitedUseAppCheckTokens: true`:

```javascript
const ai = getAI(app, {
  backend: new GoogleAIBackend(),
  useLimitedUseAppCheckTokens: true,
});
```

This instructs the SDK to fetch fresh, single-use (5-minute TTL) App Check
tokens (such as via reCAPTCHA Enterprise or the debug provider) for requests
rather than reusing standard cached App Check tokens.

## Core Capabilities

### Text-Only Generation

```javascript
async function generateText(prompt) {
  const result = await model.generateContent(prompt);
  // `result.response` is a plain object for generateContent (only the
  // generateContentStream result's `.response` is a Promise).
  const response = result.response;
  return response.text();
}
```

## App Check

See
[App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider.md.txt)
for setup instructions.

App Check debug tokens for local development and CI/CD:

- **Local development**: Set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` before
  initializing App Check (generates a token in the browser console; do not
  hardcode secret strings in client code).
- **CI/CD**: Pass the pre-provisioned token from the environment instead (e.g.
  `self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.APP_CHECK_DEBUG_TOKEN`).

### Debug Token Persistence

When testing AI Logic on Web with App Check, clearing site data, using
incognito/private windows, or switching browsers generates a new debug token
when `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` is used. To avoid this debug
token churn without leaking secrets into client bundles, load a stable token
from a gitignored local environment file:

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** Never hardcode
> debug token strings in web source code. Always load them from a local,
> gitignored environment file.

```javascript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// Browser only: reCAPTCHA (and `self`) are unavailable during server rendering.
if (typeof window !== "undefined") {
  // Each branch checks its framework's exact env variable so a Vite app can't
  // accidentally match the Next.js branch (and vice versa).
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN
  ) {
    // ✅ SAFE: Next.js inlines NEXT_PUBLIC_* at build time; keep the value in a gitignored .env.local
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN;
  } else if (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_APPCHECK_DEBUG_TOKEN
  ) {
    // ✅ SAFE: Vite inlines VITE_* at build time; keep the value in a gitignored .env.local
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  } else if (
    (typeof process !== "undefined" && process.env.NODE_ENV === "development") ||
    (typeof import.meta !== "undefined" && import.meta.env?.DEV)
  ) {
    // Dev fallback: auto-generate a debug token (printed to the browser console).
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("/* reCAPTCHA site key */"),
    isTokenAutoRefreshEnabled: true,
  });
}
```

> [!IMPORTANT] **Server rendering (Next.js, SvelteKit, etc.):**
> `initializeAppCheck` and the reCAPTCHA provider only work in the browser. Run
> the block above from client-side code only (for example a `"use client"`
> component or inside `useEffect`), never during SSR. If server-rendered code
> must call Firebase AI Logic, use
> [`initializeServerApp`](https://firebase.google.com/docs/web/ssr-apps.md.txt)
> and pass it the App Check token obtained on the client.
