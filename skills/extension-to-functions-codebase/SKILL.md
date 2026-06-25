---
name: extension-to-functions-codebase
description: Skill for converting an installed Firebase Extension (or extension source) to a standalone Cloud Functions for Firebase (CF3) codebase, including upgrading triggers from V1 to V2
---

# Extension to Functions Codebase Migration

## Overview

This skill guides the agent in migrating a Firebase Extension repository or instance into a standalone, self-owned Cloud Functions for Firebase (CF3) codebase. 

It leverages the GA capabilities of the CF3 Fabricator to handle permissions, dependencies, and lifecycle hooks natively in the cloud, and provides instructions for modernizing legacy V1 triggers to V2 using the Destructuring Compatibility Shim.

---

## Triggers
Activate this skill when a user asks to migrate or convert an installed Firebase Extension (or extension source code) into a standalone functions codebase.

---

## Getting Started & Git Safety

1.  **Git Status**: Verify the workspace has a clean git status before starting.
2.  **In-Place Copying**: If the user asks to copy the code to a new subdirectory within the same repository:
    *   Use `git cp` (or copy files and commit) to copy the extension's source directory to the target functions codebase directory.
    *   Commit immediately with the message:
        `"Copying [extension-name] extension to [directory] in preparation for rewrite"`

---

## Rules and Constraints

### 1. Zero-Local-Overhead (CF3 Integration)
Assume that CF3 Workload Identities and SDK Lifecycle Hooks are fully GA. 
*   **Do NOT** output instructions or scripts telling the user to run `gcloud` commands or create service accounts.
*   **Do NOT** write code comments telling the user to manually enable Google APIs in the cloud console.
*   Instead, use declarative `requiresAPI` and `requiresRole` imports from the SDK.

### 2. Global Parameter Access Restriction
*   **Never call `.value()` on any parameter at the global scope.**
*   If a global variable or class instance is initialized using a parameter value, declare the variable globally and initialize it inside the `onInit()` callback:
    ```typescript
    const bqDataset = defineString("DATASET_ID");
    let bqClient: BigQuery;

    onInit(() => {
      bqClient = new BigQuery({ datasetId: bqDataset.value() });
    });
    ```

### 3. Concurrency & Cost Parity for V2
When upgrading triggers to V2:
*   By default, V2 functions enable concurrency (up to 80 requests per instance).
*   If you want to maintain V1 fractional CPU pricing (and disable concurrency), set `cpu: "gcf_gen1"` in the function's options object.

---

## Step-by-Step Migration Execution

### Step 1: Code Extraction & Package Merge
1. Extract the extension's trigger source code (usually located under `functions/src/` or a dedicated source zip) into the targeted codebase directory.
2. Merge all dependencies and peer dependencies from the extension's `package.json` into the root `package.json` of the functions project.
3. Align Node engines and dependencies:
   *   Read the runtime engine specified in the extension's `extension.yaml` (e.g., `nodejs20` maps to `"node": "20"`).
   *   Update `package.json` `engines` and `tsconfig.json` compiler options to target this runtime version.

### Step 2: Parameterization Mapping
1. Read the list of all parameters declared in `extension.yaml`.
2. Define a matching parameter in the codebase for each one:
   *   If type is `secret`, use `defineSecret('PARAM_NAME')`.
   *   Otherwise, use `defineString('PARAM_NAME')` or `defineInt('PARAM_NAME')`.
3. Locate all `process.env.PARAM_NAME` calls in the code and replace them with `PARAM_NAME.value()`, ensuring the global scope constraint is respected.
4. **Custom Events**: If the extension emits custom events, list them as a `multiSelect` parameter named `events` with the label `"Events to emit"`. The description should be `"Select the events that this function should emit from the following list:"`, listing the events as options in `*[type]*: [description]\n` format.
5. Generate a local `.env` file in the functions folder containing the active parameter values for local execution and deployment.

### Step 3: Upgrading V1 Functions to V2 (Modernization)
If the extracted functions are written using the legacy Firebase Functions V1 SDK, upgrade them to V2 to ensure compatibility with CF3 Workload Identities:

1.  **Imports**: Replace legacy `* as functions` imports with targeted V2 trigger imports from `firebase-functions/v2/...` (e.g. `onDocumentCreated`, `onMessagePublished`).
2.  **Signature Modernization (Destructuring Shim)**:
    Use the Destructuring Compatibility Shim to preserve internal V1 business logic. Instead of accepting two parameters `(data, context)`, accept a single `CloudEvent` object and destructure `{ [shimmedKey], context }`.
    *   *Example (Pub/Sub)*:
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
    *   Refer to [signature-mapping.md](references/signature-mapping.md) for the exact shimmed keys for each trigger type.
3.  **HTTP Callables**: Callables do not use the destructuring shim. Rewrite the signature to destructure `({ data, auth })` directly. The legacy `context` object is unavailable in V2 callables.
4.  **Options Migration**: Move trigger configurations (memory, timeouts, secrets) from `.runWith(...)` to the V2 options argument (passed as the first parameter). Refer to [configuration-migration.md](references/configuration-migration.md) for property mapping.

### Step 4: Declarative Requirements Injection
Inject the required IAM roles and APIs at the very top of the main entry point file (e.g., `index.ts`):
1. **APIs**: For each service listed in the `apis` field in `extension.yaml`, inject `requiresAPI("service-name.googleapis.com")`.
2. **Roles**: For each role listed in the `iamRoles` field in `extension.yaml`, inject `requiresRole("roles/role-name")`.

*Example Headers*:
```typescript
import { requiresAPI, requiresRole } from "firebase-functions/core";

requiresAPI("bigquery.googleapis.com");
requiresRole("roles/bigquery.dataEditor");
```

### Step 5: Lifecycle Hook Migration
If `extension.yaml` contains `lifecycleEvents` (such as `onInstall` / `onUpdate` triggers):
1. Ensure the backing function is defined using `functions.tasks.taskQueue().onDispatch(...)` (or `onTaskDispatched` in V2).
2. Inject the declarative lifecycle call at the bottom of the entry point:
   ```typescript
   import { afterInstall } from "firebase-functions/lifecycle";

   afterInstall({
     task: { function: "myLifecycleTaskFunction" }
   });
   ```

### Step 6: Firebase Integration & Verification
1. Add the newly created functions codebase configuration under the `functions` block in `firebase.json`.
2. Run `npm run build` (or `npx tsc`) to verify no compilation or type errors exist.
3. **Tests**: If unit tests exist in the codebase:
   *   Run `npm test` to verify compliance.
   *   *Note*: Upgraded triggers change signature from two arguments `(data, context)` to one destructured object `({ change, context })`. Update test mocks to pass a single object with the correct shimmed key.

---

## References
*   **Destructuring Shim**: See [destructuring-shim.md](references/destructuring-shim.md) for details on event property translation.
*   **Trigger Mapping**: See [signature-mapping.md](references/signature-mapping.md) for V1 vs V2 trigger definitions and shim keys.
*   **Configuration & Parameters**: See [configuration-migration.md](references/configuration-migration.md) for runWith and parameter definition mappings.
