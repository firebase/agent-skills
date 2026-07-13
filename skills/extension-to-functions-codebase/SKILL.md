---
name: extension-to-functions-codebase
description: Skill for converting an installed Firebase Extension (or extension source) to a standalone Cloud Functions for Firebase codebase or publishable npm package, including upgrading triggers from V1 to V2 and configuring lifecycle hooks and declarative security
---

# Extension to Functions Codebase & npm Package Migration

## Overview

This skill guides the agent in migrating a Firebase Extension repository or
instance into either:

1. **A standalone Cloud Functions for Firebase codebase** (`firebase-functions`,
   for end-user app integration), or
1. **A publishable npm package / shareable open source package** (for extension
   publishers distributing reusable V2 functions).

It leverages native Cloud Functions for Firebase GA capabilities to handle
permissions, dependencies, and lifecycle hooks natively in code, and provides
instructions for modernizing legacy V1 triggers to V2 using the Destructuring
Compatibility Shim.

______________________________________________________________________

## Triggers

Activate this skill when a user asks to:

- Migrate or convert an installed Firebase Extension into a standalone functions
  codebase.
- Convert an extension repository into a publishable npm package (shareable open
  source package).
- Upgrade extension triggers from V1 to V2.

______________________________________________________________________

## Target Migration Workflows

Before starting, determine the target destination with the developer:

- **Target A: Local Functions Codebase** (End-User App Integration)

  - Output: Source code placed in the project's `functions/src/` folder.
  - Configuration: Parameters defined via `defineString`, `defineSecret`, etc.
    in `.env`.
  - Deployment: Deployed directly via `firebase deploy --only functions`.

- **Target B: Publishable npm Package / Shareable Open Source Package**

  - Output: Reusable npm package containing exported V2 functions.
  - Configuration: `package.json` with `exports` map and `firebase-functions`
    declared in `dependencies` (or `peerDependencies`).
  - Usage: End users install the package (`npm i <package-name>`) and re-export
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

### 1. Zero-Local-Overhead (Cloud Functions Integration)

Assume Cloud Functions for Firebase Workload Identities, Declarative Security,
and SDK Lifecycle Hooks are fully GA.

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

### Step 1: Inventory the Extension

Conduct a complete inventory of everything the extension declares, ships, and
documents so that nothing is lost during migration:

1. **Inventory `extension.yaml`**:
   - `params`: Convert to Functions params (`defineString`, `defineSecret`,
     etc.).
   - `apis`: Convert to `requiresAPI(...)` declarations.
   - `roles`: Convert to `requiresRole(...)` declarations.
   - `lifecycleEvents` (`onInstall`, `onUpdate`, `onConfigure`): Convert to
     `afterFirstDeploy` and `afterRedeploy` hooks.
   - `resources`: Note all function triggers to convert from 1st gen
     (`firebase-functions/v1`) to 2nd gen (`firebase-functions/v2`), including
     standard event triggers, HTTP handlers, and task queues
     (`onTaskDispatched`).
1. **Inventory Files & Tooling**:
   - `functions/`: Source code, triggers, helpers, and task queue handlers.
   - Documentation: `README.md`, `PREINSTALL.md`, and `POSTINSTALL.md`.
   - `scripts/`: Note any backfill, import, or helper scripts shipped with the
     extension.

### Step 2: Create / Update `package.json`

Create an npm package for the migrated extension code (either at project root or
in a dedicated workspace directory):

- Set a publishable package name (`name: "<package-name>"`).
- **Preserve Dev & Test Dependencies**: Preserve all existing `devDependencies`,
  test runners (`jest`, `ts-jest`, `@types/jest`, `mocha`, `@types/mocha`), and
  test scripts (`"test": "..."`) from the legacy extension
  (`functions/package.json` or root `package.json`). Do not drop test frameworks
  or type definitions.
- Declare `firebase-functions` (e.g. `^7.0.0`) in `dependencies` (or
  `peerDependencies` if creating a lightweight middleware package where the root
  consumer manages the runtime version):
  ```json
  {
    "name": "<package-name>",
    "version": "1.0.0",
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "exports": {
      ".": {
        "types": "./lib/index.d.ts",
        "default": "./lib/index.js"
      }
    },
    "engines": {
      "node": ">=22"
    },
    "dependencies": {
      "firebase-admin": "^12.0.0",
      "firebase-functions": "^7.0.0"
    }
  }
  ```

### Step 3: Move Function Code & Expose Deployable Functions

Move the extension's function source into the package's `src/` folder:

1. Keep normal Firebase trigger exports. The package must expose deployable
   functions that end users can re-export from their entrypoint (`index.ts`).
1. Document that consumers must deploy packaged functions by re-exporting them:
   ```typescript
   export * from "<package-name>";
   // Or named exports:
   // export { syncV2, initBigQuerySync } from "<package-name>";
   ```
   *Note*: A bare import (`import "<package-name>"`) is not enough. The Firebase
   CLI only deploys functions exported from the user's root entry file.

### Step 4: Upgrade Functions from 1st Gen to 2nd Gen

Convert each exported 1st gen function trigger (`onWrite`, `onRequest`,
`tasks.taskQueue().onDispatch`) to its 2nd gen equivalent (`onDocumentWritten`,
`onRequest`, `onTaskDispatched` from `firebase-functions/v2/...`):

1. **Signatures & Destructuring Shim**: Use the Destructuring Compatibility Shim
   (`{ shimmedKey, context }`) to preserve V1 business logic without rewriting
   function bodies. See [signature-mapping.md](references/signature-mapping.md)
   and [destructuring-shim.md](references/destructuring-shim.md).
1. **Authentication Triggers Exception**: If your extension uses v1
   Authentication Triggers (`auth.user().onCreate()`, `auth.user().onDelete()`),
   instruct the agent to check live whether a 2nd gen alternative exists in the
   installed `firebase-functions` package or live documentation. If 2nd gen Auth
   triggers are not yet supported for those events, warn the user clearly and
   halt or refuse the migration for those specific triggers until a V2
   alternative becomes available.

### Step 5: Replace Extension Params with Functions Params

Each parameter in `extension.yaml` becomes a Parameterized Configuration call:

1. Map parameter primitives and attributes:
   - Type `string` ->
     `defineString("PARAM_NAME", { label: "...", description: "...", default: "..." })`
   - Type `secret` -> `defineSecret("PARAM_NAME")`
   - Type `int` -> `defineInt("PARAM_NAME", { label: "...", default: 123 })`
   - Type `boolean` -> `defineBoolean("PARAM_NAME", { default: true })`
   - Type `select` / `multiSelect` -> map `options` into `input`:
     `defineString("PARAM_NAME", { input: { select: { options: [{ value: "val", label: "Val" }] } } })`
   - `validationRegex` -> map into text input options:
     `defineString("PARAM_NAME", { input: { text: { validationRegex: "^[a-z]+$" } } })`
1. Read parameter values inside handlers using `paramName.value()`.
1. **Keep Exact Parameter Names**: Never change parameter names
   (`COLLECTION_PATH`, `DATASET_ID`, etc.) so that existing values carry over
   seamlessly in `.env`.

### Step 6: Migrate Internal Task Queue Calls (`queue.enqueue(...)`)

If your extension code enqueues tasks onto its own queue using the Admin SDK
(`getFunctions().taskQueue(...)`):

- Under the Extensions runtime, the Admin SDK resolved queues by function name
  plus `process.env.EXT_INSTANCE_ID`.
- **In an npm package / regular codebase**: Remove the second argument
  (`EXT_INSTANCE_ID`) entirely. The Admin SDK automatically targets the current
  codebase:
  ```typescript
  // Before (extension runtime):
  // const queue = getFunctions().taskQueue(`locations/${region}/functions/syncBigQuery`, process.env.EXT_INSTANCE_ID);

  // After (npm package):
  const queue = getFunctions().taskQueue(`locations/${region}/functions/syncBigQuery`);
  await queue.enqueue(taskData);
  ```

### Step 7: Migrate Secrets

For parameters declared with `type: secret`:

1. Declare the secret explicitly:
   ```typescript
   import { defineSecret } from "firebase-functions/params";
   const apiKey = defineSecret("API_KEY");
   ```
1. Bind the secret in the trigger options:
   ```typescript
   export const fn = onRequest({ secrets: [apiKey] }, handler);
   ```
1. Keep exact secret names unchanged so existing Secret Manager bindings work.

### Step 8: Declare Required APIs and IAM Roles

Replace `apis` and `roles` from `extension.yaml` with declarative code in your
entry file:

```typescript
import { requiresAPI, requiresRole } from "firebase-functions";

requiresAPI("bigquery.googleapis.com", "Needed to write changelog rows");
requiresRole("roles/bigquery.dataEditor");
requiresRole("roles/bigquery.user");
```

At deploy time, the Firebase CLI automatically grants these roles to the managed
runtime service account and enables the required APIs.

### Step 9: Convert Lifecycle Hooks (`afterFirstDeploy` & `afterRedeploy`)

Replace `lifecycleEvents` (`onInstall`, `onUpdate`, `onConfigure`) with SDK
lifecycle hooks:

1. Convert task queue handlers (`initBigQuerySync`, `setupBigQuerySync`) to V2
   `onTaskDispatched` from `firebase-functions/v2/tasks` (removing legacy
   `getExtensions().runtime().setProcessingState(...)` calls).
1. Register lifecycle hooks in code:
   ```typescript
   import { afterFirstDeploy, afterRedeploy } from "firebase-functions/v2";

   // Replaces onInstall:
   afterFirstDeploy({
     task: {
       function: "runInitialSetup",
       body: {}
     }
   });

   // Replaces onUpdate & onConfigure:
   afterRedeploy({
     task: {
       function: "runInitialSetup",
       body: { reconcile: true }
     }
   });
   ```
1. Ensure handlers are idempotent and document manual rerun commands:
   ```bash
   firebase functions:lifecycle:run afterFirstDeploy CODEBASE_NAME
   firebase functions:lifecycle:run afterRedeploy CODEBASE_NAME
   ```

### Step 10: Document Setup for Your Users (`README.md`)

Preserve whatever documentation, secrets, and setup instructions the original
extension already documented in `README.md` (and `PREINSTALL.md` /
`POSTINSTALL.md`), updating them as needed:

1. **Update Configuration References**: Replace instructions referencing legacy
   `extension.yaml` installation prompts or `ext-*.env` files with standard
   `.env` Parameterized Configuration setup matching the `defineString`
   parameters.
1. **Include Re-export Snippet**: Ensure the basic root re-export snippet is
   shown (`export * from "<package-name>";`) so users know how to expose the
   functions in their root `index.ts`.
1. **Avoid Unnecessary Boilerplate**: Do not generate redundant comparison
   tables or generic installation steps if the setup is self-evident in the code
   or already covered by existing README sections.

### Step 11: Build & Test Verification

1. **Verify Source Compilation**: Run `npm run build` (`tsc`) to ensure no
   TypeScript compilation errors in `src/`.
1. **Verify Unit Test Suite & Type Definitions**:
   - If existing unit tests (`__tests__/`, `test/`) are present in the
     extension:
     - Ensure `@types/jest` (or the original test framework types) are present
       in `devDependencies` so test files type-check cleanly.
     - Update test invocations for upgraded V2 triggers to pass a single
       destructured event object
       (`({ change: mockChange, context: mockContext })` instead of positional
       arguments `(mockChange, mockContext)`).
     - Run `npm test` or type-check test files (`npx tsc --noEmit`) to verify
       zero regressions.

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
