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
    `peerDependencies: { "firebase-functions": "^7.0.0" }`.
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
   - `resources`: Convert V1 triggers to V2, and task queue functions to
     `onTaskDispatched`.
1. **Inventory Files & Tooling**:
   - `functions/`: Source code, triggers, helpers, and task queue handlers.
   - Documentation: `README.md`, `PREINSTALL.md`, and `POSTINSTALL.md` (migrate
     setup warnings and billing notes to package README).
   - `scripts/`: Note any backfill, import, or helper scripts shipped with the
     extension.

### Step 2: Create / Update `package.json`

Create an npm package for the migrated extension code (either at project root or
in a dedicated workspace directory):

- Set a publishable package name (`name: "<package-name>"`).
- Move `firebase-functions` from `dependencies` to `peerDependencies`:
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
    "peerDependencies": {
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

Convert each exported 1st gen function trigger to its 2nd gen equivalent
(`firebase-functions/v2/...`):

1. **Signatures & Destructuring Shim**: Use the Destructuring Compatibility Shim
   (`{ shimmedKey, context }`) to preserve V1 business logic without rewriting
   function bodies. See [signature-mapping.md](references/signature-mapping.md)
   and [destructuring-shim.md](references/destructuring-shim.md).
1. **Authentication Triggers Exception**: If your extension uses v1
   Authentication Triggers (`auth.user().onCreate()`, etc.), keep those specific
   triggers on **1st gen** for now, as 2nd gen Auth triggers are not yet
   supported. Call this out clearly in your package README.

### Step 5: Replace Extension Params with Functions Params

Each parameter in `extension.yaml` becomes a Parameterized Configuration call:

1. Map parameter types:
   - Type `string` / `select` -> `defineString("PARAM_NAME", { label: "..." })`
   - Type `secret` -> `defineSecret("PARAM_NAME")`
   - Type `int` -> `defineInt("PARAM_NAME")`
   - Type `boolean` -> `defineBoolean("PARAM_NAME")`
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

Write a comprehensive package README containing:

1. **Installation Step**: `npm install <package-name>`
1. **Re-export Snippet**: Show the exact snippet users must add to `index.ts`:
   ```typescript
   export * from "<package-name>";
   ```
1. **`.env` Configuration Table & Sample Block**: List required parameters.
1. **Secrets & IAM Roles**: List declared secrets and `requiresRole(...)` roles.
1. **Lifecycle Hooks & Rerun Commands**: Explain setup task and rerun CLI
   commands.
1. **What Changed Comparison Table**:
   | Concern      | As the extension             | As `<package-name>`                    |
   | :----------- | :--------------------------- | :------------------------------------- |
   | Install      | Extensions runtime           | `npm install` into Functions codebase  |
   | Config       | Extension params             | Functions params via `.env`            |
   | IAM          | Granted by Extensions        | `requiresRole(...)`, applied at deploy |
   | Provisioning | Lifecycle task by Extensions | `afterFirstDeploy` / `afterRedeploy`   |
1. **Multiple Instances & Troubleshooting**: Note separate codebases/prefixing
   for multiple instances, checking re-exports, and rerunning failed lifecycle
   hooks.

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
