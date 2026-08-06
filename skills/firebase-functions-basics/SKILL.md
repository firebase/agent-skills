---
name: firebase-functions-basics
description: Guide for setting up and using Cloud Functions for Firebase. Use this skill when the user's app requires server-side logic, integrating with third-party APIs, or responding to Firebase events.
compatibility: This skill requires the Firebase CLI. Install it by running `npm install -g firebase-tools`.
---

## Prerequisites

- **Firebase Project**: Created via `firebase projects:create` (see `firebase-basics`).
- **Firebase CLI**: Installed and logged in (see `firebase-basics`).

## Core Concepts

Cloud Functions for Firebase lets you automatically run backend code in response to events triggered by Firebase features and HTTPS requests. Your code is stored in Google's cloud and runs in a managed environment.

### 1st-gen vs 2nd-gen

This section **only applies to Node.js**, since all Python functions are 2nd gen.

- Always use 2nd-gen functions for new development. They are powered by Cloud Run and offer better performance and configurability.
- Use `firebase-functions` SDK version 7.0.0 and above.
- Use 2nd gen Auth triggers if they are available. If not, fallback to 1st gen for Auth triggers only.
- Avoid writing functions triggered by Analytics events. These are not supported in 2nd gen and are discouraged.
- Use top-level imports (e.g., `firebase-functions/https`). These are 2nd gen by default. If 1st gen is required, import from the `firebase-functions/v1` import path.

### Secrets Management

For sensitive information like API keys (e.g., for LLMs, payment providers, etc.), **always** use `defineSecret` (Node.js) or `SecretParam` (Python). This stores the value securely in Cloud Secret Manager.

### Firebase Admin SDK

To interact with Firebase services like Firestore, Auth, or RTDB from within your functions, you need to initialize the Firebase Admin SDK. Call `initializeApp` without any arguments so that Application Default Credentials are used.

## Workflow

### 1. Provisioning & Setup

Functions can be initialized using the CLI or manually. Ensure you have initialized the Firebase Admin SDK to interact with other Firebase services. 

See the language-specific references to learn how to properly install and initialize the Admin SDK:
- Node.js: [references/node_setup.md](references/node_setup.md)
- Python: [references/python_setup.md](references/python_setup.md)

### 2. Writing Functions

For Node.js, see [references/node_setup.md](references/node_setup.md). For Python, see [references/python_setup.md](references/python_setup.md)

### 3. Local Development & Deployment

The CLI will prompt for a secret's value at deploy time. Alternatively, a human can set the secret using the Firebase CLI command:

```bash
firebase functions:secrets:set <SECRET_NAME>
```

#### Development Commands

See the language references for detailed setup and dependency instructions.

```bash
# Run emulators for local development.
firebase emulators:start

# If you need to run another script with the emulator, like tsc,
# use `emulators:exec` instead of `emulators:start`.
firebase emulators:exec "tsc --watch"

# Deploy functions (Building is handled automatically if needed)
firebase deploy --only functions
```