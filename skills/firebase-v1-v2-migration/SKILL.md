---
name: firebase-v1-v2-migration
description: Use this skill when a user wants to upgrade their legacy Firebase Functions from V1 (GCF 1st Gen) to V2 (GCF 2nd Gen) safely without rewriting their internal business logic. This skill relies on the Destructuring Compatibility Shim.
---
# Prerequisites
Please ensure the workspace is ready for V2 before attempting a code migration:
1.  **Configuration Check**: Ensure the workspace has transitioned away from functions.config() to Parameterized Configuration or standard environment variables.
2.  **Dependencies**: The project must be using firebase-functions version that supports V2 (>= 4.0.0).

# 🔍 Pre-Migration Checklist
Before modifying any code, the agent should run a quick scan:
1.  **Scan for legacy configs**: Run a `grep` or text search for usages of `functions.config()`.
    - **Action**: If found, **stop and warn the user** that these configs will evaluate to `undefined` in V2 unless they migrate to Parameterized Configuration or standard `.env` variables first.

# Principles of Safe Migration
Always follow these principles to ensure zero-touch logic migration:
1.  **Use Context-Aware Editing over Global Regex**: Never use naive find-and-replace. Rely on syntax-aware editing (such as an AI agent reading the file context and making precise edits, or tools like ts-morph/ast parsers) to ensure context isolation.
2.  **Signature Modernization with Destructuring**: Do NOT rewrite the internal variable usages of context or params inside the function body. Instead, use JavaScript's native object destructuring in the new V2 signature parameters. (Note: For `https.onCall`, the context shim is not available; you should destructure `auth` and `data` directly from the request object instead of expecting a `.context` property).

### 🛡️ Example Transformation

#### Before (V1 Legacy)
```typescript
import * as functions from "firebase-functions";
export const processOrder = functions.pubsub.topic("orders").onPublish((message, context) => {
  const orderId = message.json.id;
  console.log(`Processing order ${orderId} at ${context.timestamp}`);
});
```

#### After (V2 Target - Safe Migration)
```typescript
import { onMessagePublished } from "firebase-functions/v2/pubsub";
// Using direct object destructuring in the signature!
export const processOrder = onMessagePublished("orders", ({ message, context }) => {
  const orderId = message.json.id; // Legacy logic remains untouched!
  console.log(`Processing order ${orderId} at ${context.timestamp}`);
});
```

# Verification
After making any migration edits, immediately run the following verification steps:
1. Run `npm run build` to ensure the TypeScript compiler is happy with the types and parameters.
2. Run `npm test` to verify no regressions occurred in existing unit tests.

> [!WARNING]
> **Test Signature Mismatch**: The destructuring shim changes the function signature from two arguments `(data, context)` to a single destructured object `({ message, context })`. 
>
> Existing V1 unit tests that invoke the function with two parameters separately (e.g., `myFn(mockData, mockContext)`) **will fail** because the function treats `mockData` as the entire event object. You will need to update test calls to pass a single object. 
>
> **Crucial**: The key name in the test mock must match the specific **Shimmed Key** for that trigger (e.g., `change` for `onDocumentWritten`, `snapshot` for `onDocumentCreated`, `message` for PubSub, or `object` for Storage). 
>
> Example: `myFn({ change: mockChange, context: mockContext })` or `myFn({ message: mockMessage, context: mockContext })`. See [signature-mapping.md](references/signature-mapping.md) for the exact keys.

# References
- **Deep Dive into Shims**: See the architectural choices for the shim in [destructuring-shim.md](references/destructuring-shim.md).
- **Function Name Mapping**: See the V1 vs V2 function signature mapping table in [signature-mapping.md](references/signature-mapping.md).
