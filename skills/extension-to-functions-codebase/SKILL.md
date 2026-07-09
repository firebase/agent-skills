---
name: extension-to-functions-codebase
description: Skill for converting an installed Firebase Extension (or extension source) to a standalone Cloud Functions for Firebase (CF3) codebase or publishable npm package, including upgrading triggers from V1 to V2 and configuring lifecycle hooks and declarative security
---

# Extension to Functions Codebase & npm Package Migration

## Overview

This skill guides the agent in migrating a Firebase Extension repository or
instance into either:

1. **A standalone Cloud Functions for Firebase (CF3) codebase** (for end-user
   app integration), or
1. **A publishable npm package / function kit** (for extension publishers
   distributing reusable V2 functions).

It leverages CF3 GA capabilities to handle permissions, dependencies, and
lifecycle hooks natively in code, and provides instructions for modernizing
legacy V1 triggers to V2 using the Destructuring Compatibility Shim.

______________________________________________________________________

## Triggers

Activate this skill when a user asks to:

- Migrate or convert an installed Firebase Extension into a standalone functions
  codebase.
- Convert an extension repository into a publishable npm package (function kit).
- Upgrade extension triggers from V1 to V2.

______________________________________________________________________

## Target Migration Workflows

Before starting, determine the target destination with the developer:

- **Target A: Local Functions Codebase** (End-User App Integration)

  - Output: Source code placed in the project's `functions/src/` folder.
  - Configuration: Parameters defined via `defineString`, `defineSecret`, etc.
    in `.env`.
  - Deployment: Deployed directly via `firebase deploy --only functions`.

- **Target B: Publishable npm Package / Function Kit** (Publisher Distribution)

  - Output: Reusable npm package containing exported V2 functions.
  - Configuration: `package.json` with `exports` map and
    `peerDependencies: { "firebase-functions": ">=7.0.0" }`.
  - Usage: End users install the package (`npm i @scope/package`) and re-export
    functions in their `index.ts`.

______________________________________________________________________

## Getting Started & Git Safety

1. **Git Status**: Verify the workspace has a clean git status before starting.
1. **In-Place Copying**: If copying code to a new subdirectory within the same
   repository:
   - Use `git cp` (or copy files and commit) to copy the extension's source
     directory to the target directory.
   - Commit immediately:
     `"Copying [extension-name] extension to [directory] in preparation for rewrite"`

______________________________________________________________________

## Rules and Constraints

### 1. Zero-Local-Overhead (CF3 Integration)

Assume CF3 Workload Identities, Declarative Security, and SDK Lifecycle Hooks
are fully GA.

- **Do NOT** output instructions or scripts telling users to run manual `gcloud`
  IAM commands or create service accounts.
- **Do NOT** write code comments instructing users to manually enable Google
  APIs in the cloud console.
- Instead, use declarative `requiresAPI` and `requiresRole` imports from the
  SDK.

### 2. Global Parameter Access Restriction

- **Never call `.value()` on any parameter at global scope.**
- If a global variable or class instance is initialized using a parameter value,
  declare the variable globally and initialize it inside the `onInit()`
  callback:
  ```typescript
  import { defineString } from "firebase-functions/params";
  import { onInit } from "firebase-functions/v2";

  const bqDataset = defineString("DATASET_ID");
  let bqClient: BigQuery;

  onInit(() => {
    bqClient = new BigQuery({ datasetId: bqDataset.value() });
  });
  ```

### 3. Concurrency & Cost Parity for V2

When upgrading triggers to V2:

- By default, V2 functions enable concurrency (up to 80 requests per instance).
- If you want to maintain V1 fractional CPU pricing (and disable concurrency),
  set `cpu: "gcf_gen1"` in the function's options object.

______________________________________________________________________

## Step-by-Step Migration Execution

### Step 1: Inventory the Extension & Setup Package Structure

1. **Inventory `extension.yaml`**:

   - `params`: Convert to Functions params (`defineString`, `defineSecret`,
     etc.).
   - `apis`: Convert to `requiresAPI(...)` declarations.
   - `roles`: Convert to `requiresRole(...)` declarations.
   - `lifecycleEvents` (`onInstall`, `onUpdate`, `onConfigure`): Convert to
     `afterFirstDeploy` and `afterRedeploy` hooks.
   - `resources`: Convert V1 triggers to V2, and task queue functions to
     `onTaskDispatched`.

1. **Package Configuration (`package.json`)**:

   - **For Target A (Local Codebase)**: Merge dependencies from
     `functions/package.json` into project root `package.json`.
   - **For Target B (npm Package)**:
     - Set publishable package name (e.g. `@firebase/firestore-bigquery-export`
       or `@scope/pkg`).
     - Move `firebase-functions` from `dependencies` to `peerDependencies`
       (`"firebase-functions": ">=7.0.0"`).
     - Add `exports` map and engine requirements:
       ```json
       {
         "name": "@scope/extension-pkg",
         "version": "1.0.0",
         "main": "lib/index.js",
         "types": "lib/index.d.ts",
         "exports": {
           ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" }
         },
         "engines": { "node": ">=22" },
         "peerDependencies": { "firebase-functions": ">=7.0.0" }
       }
       ```

### Step 2: Parameterization & Secret Migration

1. Read all parameters declared in `extension.yaml`.
1. Define matching Functions params in code (e.g. `src/config.ts`):
   - Type `secret` -> `defineSecret('PARAM_NAME')`
   - Type `string` -> `defineString('PARAM_NAME')`
   - Type `select` / `multiSelect` -> `defineString('PARAM_NAME')` /
     `defineList('PARAM_NAME')`
   - Type `int` -> `defineInt('PARAM_NAME')`
1. Replace all direct `process.env.PARAM_NAME` calls with `PARAM_NAME.value()`,
   ensuring the global scope restriction is respected.
1. **Secret Binding**: For functions using secrets, bind them in the function
   options:
   ```typescript
   const apiKey = defineSecret("API_KEY");
   export const fn = onRequest({ secrets: [apiKey] }, handler);
   ```
   *Note*: Keep exact param and secret names unchanged so that existing user
   installation values in `.env` or Secret Manager carry over without
   re-prompting.

### Step 3: Upgrading Functions & Triggers (V1 to V2)

1. **Imports**: Replace legacy `* as functions` imports with targeted V2 trigger
   imports from `firebase-functions/v2/...` (e.g. `onDocumentCreated`,
   `onMessagePublished`, `onValueWritten`, `onObjectFinalized`).
1. **Signature Modernization (Destructuring Shim)**: Use the Destructuring
   Compatibility Shim to preserve internal V1 business logic without rewriting
   function bodies. Instead of `(data, context)`, accept a single `CloudEvent`
   and destructure `{ shimmedKey, context }`.
   - *Pub/Sub Example*:
     ```typescript
     // V1 Legacy
     export const myFn = functions.pubsub.topic("orders").onPublish((message, context) => {
       const orderId = message.json.id;
     });

     // V2 + Shim
     import { onMessagePublished } from "firebase-functions/v2/pubsub";
     export const myFn = onMessagePublished("orders", ({ message, context }) => {
       const orderId = message.json.id; // Logic remains untouched!
     });
     ```
   - Refer to [signature-mapping.md](references/signature-mapping.md) for full
     trigger key mappings.
1. **HTTP Callables**: Callables do not use the destructuring shim. Rewrite the
   signature to destructure `({ data, auth })` directly.
1. **Internal Task Queue Enqueue Calls**: If the code enqueues tasks using
   `getFunctions().taskQueue(...)`:
   - Replace `process.env.EXT_INSTANCE_ID` with `process.env.KIT_INSTANCE_ID`
     (or codebase equivalent).
   - Ensure `firebase-admin` dependency version supports task queue enqueueing
     in plain codebases.

### Step 4: Declarative Security Injection (IAM Roles & APIs)

Inject declarative security requirements at the top of the main entry file (e.g.
`src/index.ts`):

```typescript
import { requiresAPI, requiresRole } from "firebase-functions/v2";

requiresAPI("bigquery.googleapis.com", "Needed to write changelog rows and views");

requiresRole("roles/bigquery.dataEditor");
requiresRole("roles/datastore.user");
requiresRole("roles/bigquery.user");
```

At deploy time, the Firebase CLI will grant these declared roles to the
codebase's managed runtime service account.

### Step 5: Lifecycle Hook Migration (`afterFirstDeploy` & `afterRedeploy`)

If `extension.yaml` declares `lifecycleEvents` (`onInstall`, `onUpdate`,
`onConfigure`):

1. **Convert Task Queue Handlers**: Upgrade 1st gen task queue functions to V2
   `onTaskDispatched` from `firebase-functions/v2/tasks`:

   ```typescript
   import { onTaskDispatched } from "firebase-functions/v2/tasks";

   export const initBigQuerySync = onTaskDispatched(
     { retryConfig: { maxAttempts: 5 } },
     async (request) => {
       await initializeResources(request.data);
     }
   );
   ```

   *Note*: Remove calls to `getExtensions().runtime().setProcessingState(...)`
   as lifecycle state is managed by CF3.

1. **Register Lifecycle Hooks**: Inject declarative lifecycle hooks:

   ```typescript
   import { afterFirstDeploy, afterRedeploy } from "firebase-functions/v2";

   // Replaces onInstall:
   afterFirstDeploy({ task: { function: "initBigQuerySync" } });

   // Replaces onUpdate & onConfigure:
   afterRedeploy({ task: { function: "setupBigQuerySync" } });
   ```

1. **Idempotency & Manual Rerun**: Ensure lifecycle handlers are idempotent.
   Document that users can manually rerun hooks if needed:
   `firebase functions:lifecycle:run afterFirstDeploy CODEBASE_NAME`

### Step 6: Package Exporting & Documentation (Publisher Path)

If creating an npm package (Target B):

1. **Re-export Functions in Package Entry (`src/index.ts`)**: Ensure all
   deployable V2 functions and task queue handlers are exported:
   ```typescript
   export { syncV2, initBigQuerySync, setupBigQuerySync } from "./functions";
   ```
1. **End-User Re-export Instructions**: Document in `README.md` that end users
   deploy package functions by re-exporting them in their
   `functions/src/index.ts`:
   ```typescript
   export { syncV2, initBigQuerySync, setupBigQuerySync } from "@scope/extension-pkg";
   ```
1. **Package README Checklist**: Include:
   - Installation (`npm install @scope/extension-pkg`)
   - Re-export snippet for user's `index.ts`
   - Required `.env` parameter names & types
   - IAM roles declared (`requiresRole`)
   - Lifecycle hooks behavior & manual rerun commands
   - "What changed" comparison table (Extension vs npm Package)

### Step 7: Build & Verification

1. Run `npm run build` (or `npx tsc`) to ensure no compilation or type errors.
1. If unit/integration tests exist, run `npm test`.
   - Update test mocks for upgraded V2 triggers (single destructured object
     `{ change, context }` instead of two arguments `(data, context)`).

______________________________________________________________________

## References

- **Destructuring Shim**: See
  [destructuring-shim.md](references/destructuring-shim.md) for details on event
  property translation.
- **Trigger Mapping**: See
  [signature-mapping.md](references/signature-mapping.md) for V1 vs V2 trigger
  definitions and shim keys.
- **Configuration & Parameters**: See
  [configuration-migration.md](references/configuration-migration.md) for
  `runWith` options, params, and secret bindings.
