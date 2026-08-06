---
name: extension-to-functions-codebase
description: Skill for converting an installed Firebase Extension (or extension source) into a standalone Cloud Functions for Firebase codebase or publishable npm package, including V1 to V2 trigger upgrades, lifecycle hooks, and declarative security
metadata:
  category: Serverless
---

# Extension to Functions Codebase & npm Package Migration

## Overview

Migrates a Firebase Extension into either:

1. **A local Cloud Functions codebase** (`functions/src/` for app integration).
1. **A publishable npm package** (reusable open-source package exporting V2
   functions).

Leverages native Cloud Functions features (declarative IAM, Parameterized
Config, SDK Lifecycle Hooks) and modernizes 1st Gen triggers to 2nd Gen using
the Destructuring Compatibility Shim.

______________________________________________________________________

## Target Migration Workflows

- **Target A: Local Functions Codebase** (End-User App Integration)

  - Output: Code under `functions/src/`. Config in `.env`.
  - Deployment: `firebase deploy --only functions`.

- **Target B: Publishable npm Package / Shareable Package**

  - Output: Reusable npm package exporting V2 functions.
  - Configuration: `package.json` specifying `exports` map,
    `engines: { "node": ">=22" }`, and
    `peerDependencies: { "firebase-functions": ">=6.0.0" }`.
  - Usage: Consumers install package and re-export functions in `index.ts`
    (`export * from "<package-name>"`).

______________________________________________________________________

## Core Rules & Constraints

### 1. Declarative IAM & APIs (Zero-Local-Overhead)

Use native SDK declarations instead of manual `gcloud` scripts or console
instructions:

- Use `requiresRole("roles/...")` for required GCP IAM permissions.
- Use `requiresAPI("service.googleapis.com", "Description")` for Google APIs.

### 2. Global Parameter Access Restriction

- **Never call `.value()` at top-level module load scope.**
- Initialize global SDK instances inside `onInit()` or lazy getters:
  ```typescript
  import { defineString } from "firebase-functions/params";
  import { onInit } from "firebase-functions/v2";

  const dataset = defineString("DATASET_ID");
  let client: BigQuery;

  onInit(() => {
    client = new BigQuery({ datasetId: dataset.value() });
  });
  ```

### 3. V2 Concurrency & Cost Parity

V2 enables concurrency (up to 80 requests). To preserve V1 single-concurrency
pricing, set `cpu: "gcf_gen1"`.

______________________________________________________________________

## Step-by-Step Migration Execution

### Step 1: Inventory Extension Resources

1. **`extension.yaml`**:
   - `params` → `defineString`, `defineInt`, `defineBoolean`, `defineSecret`.
   - `apis` → `requiresAPI(...)`.
   - `roles` → `requiresRole(...)`.
   - `lifecycleEvents` → `afterFirstDeploy` & `afterRedeploy`.
   - `resources` → Upgrade 1st Gen triggers to 2nd Gen (`onDocumentWritten`,
     `onTaskDispatched`, `onRequest`).
1. **Files & Scripts**: Preserve devDependencies, test framework (`jest`), and
   test scripts.

### Step 2: Configure `package.json`

- Set `name: "<package-name>"`, `engines: { "node": ">=22" }`.
- Set `peerDependencies`:
  ```json
  "peerDependencies": {
    "firebase-admin": "^11.0.0 || ^12.0.0",
    "firebase-functions": ">=6.0.0"
  }
  ```
- Configure `exports` map targeting ESM/CommonJS and TypeScript declarations
  (`lib/index.js`, `lib/index.d.ts`).

### Step 3: Upgrade Triggers from V1 to V2

- Firestore: Use `onDocumentWritten` from `firebase-functions/v2/firestore`.
- Tasks: Use `onTaskDispatched` from `firebase-functions/v2/tasks`. Remove
  `EXT_INSTANCE_ID` when enqueueing tasks.
- HTTP: Use `onRequest` from `firebase-functions/v2/https`.
- Apply Destructuring Compatibility Shim (`{ change, context }`,
  `{ snapshot, context }`) where legacy 1st Gen handlers expect
  `(change, context)`.

### Step 4: Convert Lifecycle Events

Map extension lifecycle events to SDK lifecycle hooks in `src/index.ts`:

- `onInstall` → `afterFirstDeploy({ task: { function: "initTask" } })`
- `onUpdate` / `onConfigure` →
  `afterRedeploy({ task: { function: "setupTask" } })`

### Step 5: Package README & Export Instructions

Generate `README.md` containing:

1. Installation instructions (`npm install`).
1. Re-export snippet (`export * from "<package-name>"`).
1. Parameterized Configuration `.env` reference table.
1. What Changed (Extension vs Package) comparison table.

_Reminder: NEVER execute `npm publish`._
