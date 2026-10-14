# Migrating Runtime Configurations (runWith)

In Firebase Functions V1, you configured runtime settings like memory, timeout,
and service accounts using `.runWith()`. In V2, `.runWith()` is removed and
replaced by a more flexible options system.

You can configure V2 functions in two ways: **Globally** (for all functions in a
file) or **Per-Function**.

______________________________________________________________________

## 🌍 1. Global Configuration (`setGlobalOptions`)

Use `setGlobalOptions` at the top of your file to set defaults for all functions
defined after it.

### V1 Legacy

```typescript
import * as functions from "firebase-functions";

export const myFn = functions
  .runWith({
    memory: "1GB",
    timeoutSeconds: 120,
    serviceAccount: "custom-sa@my-project.iam.gserviceaccount.com",
  })
  .https.onRequest((req, res) => { ... });
```

### V2 Modern Equivalent

```typescript
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

// Set global defaults for this file
setGlobalOptions({
  memory: "1GiB", // Note: GiB instead of GB is preferred in V2 types
  timeoutSeconds: 120,
  serviceAccount: "custom-sa@my-project.iam.gserviceaccount.com",
});

export const myFn = onRequest((req, res) => { ... });
```

______________________________________________________________________

## 🎯 2. Per-Function Configuration

Pass the configuration object as the **first argument** to the V2 trigger
function.

### V1 Legacy

```typescript
export const processOrder = functions
  .runWith({ memory: "2GB" })
  .pubsub.topic("orders")
  .onPublish((message, context) => { ... });
```

### V2 Modern Equivalent

```typescript
import { onMessagePublished } from "firebase-functions/v2/pubsub";

export const processOrder = onMessagePublished(
  {
    topic: "orders",
    memory: "2GiB", // Options passed as the first argument!
  },
  ({ message, context }) => { ... } // Destructuring shim pattern
);
```

> [!TIP] **Memory Unit Recommendation**: While V1 accepted non-IEC units like
> `"1GB"` or `"2GB"`, V2 options strongly prefer IEC units like `"1GiB"`,
> `"2GiB"`, etc., to align with Cloud Run types and prevent TypeScript type
> errors.

______________________________________________________________________

## ⚠️ Common Property Translations

| V1 Property                  | V2 Property                  | Notes                                                                  |
| :--------------------------- | :--------------------------- | :--------------------------------------------------------------------- |
| `memory`                     | `memory`                     | Prefer IEC units (`"1GiB"`) instead of (`"1GB"`).                      |
| `timeoutSeconds`             | `timeoutSeconds`             | Same.                                                                  |
| `ingressSettings`            | `ingressSettings`            | Same.                                                                  |
| `vpcConnector`               | `vpcConnector`               | Same.                                                                  |
| `vpcConnectorEgressSettings` | `vpcConnectorEgressSettings` | Same.                                                                  |
| `serviceAccount`             | `serviceAccount`             | Same.                                                                  |
| `secrets`                    | `secrets`                    | Pass array of secret parameter variables, e.g. `{ secrets: [myKey] }`. |
| `failurePolicy`              | `retry`                      | Renamed to boolean `retry: true/false` in V2 Eventarc triggers.        |

______________________________________________________________________

## 🔐 3. Migrating Environment Configurations (`functions.config()`)

In V1, you used `functions.config()` to access environment configuration. In V2,
this is replaced by **Parameterized Configuration**.

### Deterministic Rules for Migration

Follow these rules to ensure a deterministic and safe migration:

#### Typing

- **Numbers**: If the value is used as a number, use `defineNumber`.
- **Secrets**: If the key contains "KEY", "SECRET", "TOKEN", or "PASSWORD", use
  `defineSecret()`.
  - *Note*: Secrets MUST be explicitly bound to the function that uses them in
    the options object using the secret parameter variable (e.g.,
    `{ secrets: [myKey] }`, where `const myKey = defineSecret("MY_KEY")`).
    Passing an unreferenced uppercase identifier will cause a TypeScript
    reference error.
- **Lists**: Use `defineList` for comma-separated lists.
- **JSON**: Use `defineJSON` for JSON strings.
- **Buckets**: If the param is a storage bucket, set `input: 'BUCKET_PICKER'`.

#### Initialization & Scope

- **Global Initialization**: If a variable was initialized globally in V1 (e.g.,
  `const client = new Client(functions.config().key)`), you must split it to
  have declaration at global scope and initialization inside `onInit`:
  ```typescript
  import { onInit } from "firebase-functions/v2";

  const myKey = defineSecret("MY_KEY");
  let client: Client;

  onInit(() => {
    client = new Client(myKey.value());
  });
  ```

#### Advanced Interpolation & Logic

- **String Interpolation**: Use the `expr` tagged template literal from
  `firebase-functions/params` (e.g., `expr`every ${period} days\`\`) instead of
  standard template literals when constructing dynamic strings with parameters.
  Do NOT call `.value()` inside `expr`.
- **Logic Operators**: Use expressions like
  `projectID.equals('prod').thenElse(1, 0)` for logical operations instead of
  ternary operators on `.value()`.

#### Built-ins

- Prefer built-in variables like `databaseURL`, `projectID`, `gcloudProject`,
  `storageBucket` rather than defining new params for these values.
