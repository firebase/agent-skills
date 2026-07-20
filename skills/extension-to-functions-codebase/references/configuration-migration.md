# Migrating Runtime Configurations (runWith)

In Cloud Functions for Firebase V1 (`firebase-functions/v1`), you configured
runtime settings like memory, timeout, and service accounts using `.runWith()`.
In V2 (`firebase-functions/v2`), `.runWith()` is removed and replaced by a more
flexible options system.

You can configure V2 functions in two ways: **Per-Function** (passing an options
object directly to the trigger) or **Globally** (`setGlobalOptions` at the top
of a file).

______________________________________________________________________

## 1. Per-Function Configuration

Pass the configuration options object as the **first argument** to the V2
trigger function. Per-function options always override any global defaults.

### V1 Legacy

```typescript
import * as functions from "firebase-functions";

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

> [!TIP] **Memory Unit Caveat**: V1 accepted `"1GB"`. V2 types strongly prefer
> IEC units like `"1GiB"`, `"2GiB"`, etc.

______________________________________________________________________

## 2. Global Configuration (`setGlobalOptions`)

Use `setGlobalOptions` at the top of your file when all or most functions in
that file share the exact same runtime requirements (e.g. identical region,
memory allocation, timeout, or service account). Individual functions can still
override specific settings by declaring per-function options.

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

// Set global defaults for all functions defined after this call in this file
setGlobalOptions({
  memory: "1GiB", // Note: GiB instead of GB is preferred in V2 types
  timeoutSeconds: 120,
  serviceAccount: "custom-sa@my-project.iam.gserviceaccount.com",
});

export const myFn = onRequest((req, res) => { ... });
```

______________________________________________________________________

## Common Property Translations

| V1 Property                  | V2 Property                  | Notes                                                           |
| :--------------------------- | :--------------------------- | :-------------------------------------------------------------- |
| `memory`                     | `memory`                     | Use `"1GiB"` instead of `"1GB"`.                                |
| `timeoutSeconds`             | `timeoutSeconds`             | Same.                                                           |
| `ingressSettings`            | `ingressSettings`            | Same.                                                           |
| `vpcConnector`               | `vpcConnector`               | Same.                                                           |
| `vpcConnectorEgressSettings` | `vpcConnectorEgressSettings` | Same.                                                           |
| `serviceAccount`             | `serviceAccount`             | Same.                                                           |
| `secrets`                    | `secrets`                    | Same.                                                           |
| `failurePolicy`              | `retry`                      | Renamed to boolean `retry: true/false` in V2 Eventarc triggers. |

______________________________________________________________________

## 3. Migrating Environment Configurations (`functions.config()`)

In V1, you used `functions.config()` to access environment configuration. In V2,
this is replaced by **Parameterized Configuration**.

### Deterministic Rules for Migration

Follow these rules to ensure a deterministic and safe migration:

#### Typing & Exports

- **Numbers**: If the value is used as a number, use `defineInt` or
  `defineNumber`.
- **Secrets**: If the key contains "KEY", "SECRET", "TOKEN", or "PASSWORD", use
  `defineSecret()` or `defineJsonSecret()`.
  - *Note*: Secrets MUST be explicitly bound to the function that uses them in
    the options object (e.g., `{ secrets: [myKey, myJsonSecret] }`). Both
    `SecretParam` and `JsonSecretParam` are supported in the `secrets` array.
- **Lists**: Use `defineList` for comma-separated lists.
- **JSON**: Use `defineJSON` for JSON strings.
- **Buckets**: If the param is a storage bucket, set `input: { text: {} }` or
  bucket selector.
- **Input Validation**: Use `nonEmpty: true` inside `input.text` or
  `input.multiSelect` to enforce non-empty parameter input during CLI prompting
  (e.g. `defineString("PARAM", { input: { text: { nonEmpty: true } } })`).
- **Type Annotations**: Import parameter types directly from
  `firebase-functions/params` (e.g.
  `import type { StringParam, SecretParam, JsonSecretParam, IntParam } from "firebase-functions/params"`).

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
  `firebase-functions/params` (e.g., `` `expr`every ${period} days` ``) instead
  of standard template literals when constructing dynamic strings with
  parameters. Do NOT call `.value()` inside `expr`.
- **Logic Operators**: Use expressions like
  `projectID.equals('prod').thenElse(1, 0)` for logical operations instead of
  ternary operators on `.value()`.

#### Built-ins

- Prefer built-in variables like `databaseURL`, `projectID`, `gcloudProject`,
  `storageBucket` rather than defining new params for these values.
