---
name: firebase-cloud-functions
description: Guide for setting up and using Cloud Functions for Firebase. Use this skill when the user's app requires server-side logic, integrating with third-party APIs, or responding to Firebase events.
compatibility: This skill requires the Firebase CLI. Install it by running `npm install -g firebase-tools`.
---

## Prerequisites

- **Firebase Project**: Created via `firebase projects:create` (see `firebase-basics`).
- **Firebase CLI**: Installed and logged in (see `firebase-basics`).

## Core Concepts

Cloud Functions for Firebase lets you automatically run backend code in response to events triggered by Firebase features and HTTPS requests. Your code is stored in Google's cloud and runs in a managed environment.

### Generation 1 vs Generation 2

This section only applies to Node.js, since all Python functions are 2nd gen.

- Always use 2nd-gen functions for new development. They are powered by Cloud Run and offer better performance and configurability.
- Use 1st-gen functions *only* for Analytics and basic Auth triggers, since those aren't supported by 2nd gen.
- Use `firebase-functions` SDK version 6.0.0 and above.
- Use top-level imports (e.g., `firebase-functions/https`). These are 2nd gen by default. If 1st gen is required (Analytics or basic Auth triggers), import from the `firebase-functions/v1` import path.

### Secrets Management

For sensitive information like API keys (e.g., for LLMs, payment providers, etc.), **always** use `defineSecret` (Node.js) or `SecretParam` (Python). This stores the value securely in Cloud Secret Manager.

If you see an API key being accessed with `functions.config` in existing functions code, offer to upgrade to params.

### Firebase Admin SDK

To interact with Firebase services like Firestore, Auth, or RTDB from within your functions, you need to initialize the Firebase Admin SDK. Call `initializeApp` without any arguments so that Application Default Credentials are used.

## Workflow

### 1. Provisioning & Setup

Functions can be initialized using the CLI or manually. Ensure you have initialized the Firebase Admin SDK to interact with other Firebase services.

1.  **Install the Admin SDK:**

    ```bash
    npm i firebase-admin
    ```

2.  **Initialize in your code:**

    ```typescript
    import * as admin from "firebase-admin";
    import { onInit } from "firebase-functions";

    onInit(() => {
      admin.initializeApp();
    });
    ```

    This should be done once at the top level of your `index.ts` file.

### 2. Writing Functions

For Node.js, see [references/node_setup.md](references/node_setup.md). For Python, see [references/python_setup.md](references/python_setup.md)

### 3. Local Development & Deployment

The CLI will prompt for secret's value at deploy time. Alternatively, a human can set the secret using the Firebase CLI command:

```bash
firebase functions:secrets:set <SECRET_NAME>
```

#### Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run emulators for local development
# This is a long-running command. A human can run this command themselves to start the emulators:
firebase emulators:start --only functions

# Deploy functions
firebase deploy --only functions
```