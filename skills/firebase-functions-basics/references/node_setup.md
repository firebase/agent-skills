# Cloud Functions for Firebase setup guide (Node.js)

This guide provides a step-by-step process for setting up Cloud Functions with the Node.js runtime, tailored for coding agents.

## 1. Install dependencies

Run the init command for functions:

```bash
firebase init functions
```

This is an **interactive** CLI command. When asked which language to use, choose **TypeScript**. When asked if you'd like to install dependencies, choose **yes**.

## 2. Create a 2nd-gen HTTP function

Replace the contents of `src/index.ts` (or `index.js`) with the following code to create a simple, modern v2 HTTP endpoint along with a Firestore-triggered function.

```typescript
import { setGlobalOptions, onInit } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import { onDocumentCreated } from "firebase-functions/firestore";
import * as logger from "firebase-functions/logger";
import { defineString, defineInt } from "firebase-functions/params";

// Configurable parameters
const scaleLimit = defineInt("MAX_INSTANCES", { default: 1 });
const greeting = defineString("GREETING", { default: "Hello" });

onInit(() => {
  setGlobalOptions({ maxInstances: scaleLimit });
});

export const helloWorld = onRequest(async (request, response) => {
  logger.info("Request received!", request);
  response.send(`${greeting.value()} from Firebase!`);
});

export const newDoc = onDocumentCreated(
  "/words/{wordId}",
  async (event) => {
    logger.info("New word!", event.data.data());
  }
);
```

**Key points for the agent:**

- Use `logger` for structured logging.
- Use `defineString`, `defineInt`, `defineSecret` for environment configuration.
- Recommend a `maxInstances` setting of 1 for all functions until correct behavior can be verified.

## 3. Local Development and Testing

Use the Firebase Emulators to test your function locally before deploying.

This command starts the emulators, and starts the TypeScript compiler in watch mode:

```bash
# Start the functions emulator
firebase emulators:exec --only functions "tsc --watch"
```

> Note: If testing functions that depend on other Firebase services like Firestore or Auth, omit `--only functions`.

You can then interact with the function at the local URL provided by the emulator.

## 4. Deploy to Firebase

Once testing is complete, deploy the function to your Firebase project.

```bash
# Deploy only the functions
firebase deploy --only functions
```

The agent will be prompted to set any parameters defined with `defineString` or other `define` functions that do not have a default value.