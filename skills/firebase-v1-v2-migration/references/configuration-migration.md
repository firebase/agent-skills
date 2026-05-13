# Migrating Runtime Configurations (runWith)

In Firebase Functions V1, you configured runtime settings like memory, timeout, and service accounts using `.runWith()`. In V2, `.runWith()` is removed and replaced by a more flexible options system.

You can configure V2 functions in two ways: **Globally** (for all functions in a file) or **Per-Function**.

---

## 🌍 1. Global Configuration (`setGlobalOptions`)

Use `setGlobalOptions` at the top of your file to set defaults for all functions defined after it.

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

---

## 🎯 2. Per-Function Configuration

Pass the configuration object as the **first argument** to the V2 trigger function.

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

> [!TIP]
> **Memory Unit Caveat**: V1 accepted `"1GB"`. V2 types strongly prefer IEC units like `"1GiB"`, `"2GiB"`, etc.

---

## ⚠️ Common Property Translations

| V1 Property | V2 Property | Notes |
| :--- | :--- | :--- |
| `memory` | `memory` | Use `"1GiB"` instead of `"1GB"`. |
| `timeoutSeconds` | `timeoutSeconds` | Same. |
| `ingressSettings` | `ingressSettings` | Same. |
| `vpcConnector` | `vpcConnector` | Same. |
| `vpcConnectorEgressSettings` | `vpcConnectorEgressSettings` | Same. |
| `serviceAccount` | `serviceAccount` | Same. |
| `secrets` | `secrets` | Same. |
| `failurePolicy` | `retry` | Renamed to boolean `retry: true/false` in V2 Eventarc triggers. |
