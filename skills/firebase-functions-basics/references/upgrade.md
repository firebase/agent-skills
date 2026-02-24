# Upgrading a 1st gen function to 2nd gen

This guide provides a step-by-step process for migrating a single Cloud Function from 1st to 2nd generation. Migrate functions one-by-one. Run both generations side-by-side before deleting the 1st gen function.

## 1. Identify a 1st-gen function to upgrade

Find all 1st-gen functions in the directory. 1st-gen functions used a namespaced API like this:

**Before (1st Gen):**

```typescript
import * as functions from "firebase-functions";

export const webhook = functions.https.onRequest((request, response) => {
  // ...
});
```

Sometimes, they'll explicitly import from the `firebase-functions/v1` subpackage, but not always.

Ask the human to pick a **single** function to upgrade from the list of 1st gen functions you found.

## 2. Update Dependencies

Ensure your `firebase-functions` and `firebase-admin` SDKs are up-to-date, and you are using a recent version of the Firebase CLI.

## 3. Modify Imports

Update your import statements to use the top-level modules.

**After (2nd Gen):**

```typescript
import { onRequest } from "firebase-functions/https";
```

## 4. Update Trigger Definition

The SDK is now more modular. Update your trigger definition accordingly.

**After (2nd Gen):**

```typescript
export const webhook = onRequest((request, response) => {
  // ...
});
```

Here are other examples of trigger changes:

### Callable Triggers

**Before (1st Gen):**

```typescript
export const getprofile = functions.https.onCall((data, context) => {
  // ...
});
```

**After (2nd Gen):**

```typescript
import { onCall } from "firebase-functions/https";

export const getprofile = onCall((request) => {
  // ...
});
```

### Background Triggers (Pub/Sub)

**Before (1st Gen):**

```typescript
export const hellopubsub = functions.pubsub.topic("topic-name").onPublish((message) => {
  // ...
});
```

**After (2nd Gen):**

```typescript
import { onMessagePublished } from "firebase-functions/pubsub";

export const hellopubsub = onMessagePublished("topic-name", (event) => {
  // ...
});
```

## 5. Use Parameterized Configuration

The `functions.config` API is deprecated and will be decommissioned in March 2027. 2nd gen functions drop support for `functions.config` in favor of a more secure interface for defining configuration parameters declaratively inside your codebase. 

To migrate your configuration to Cloud Secret Manager, use the Firebase CLI:

### 1. Export configuration with the Firebase CLI

Use the config export command to interactively export your existing environment config to a new secret in Cloud Secret Manager:

```bash
firebase functions:config:export
```

### 2. Update function code to bind secrets

To use configuration stored in the new secret in Cloud Secret Manager, use the `defineJsonSecret` API in your function source. Make sure that secrets are bound to all functions that need them.

**Before (1st Gen):**

```typescript
import * as functions from "firebase-functions";

export const myFunction = functions.https.onRequest((req, res) => {
  const apiKey = functions.config().someapi.key;
  // ...
});
```

**After (2nd Gen):**

```typescript
import { onRequest } from "firebase-functions/v2/https";
import { defineJsonSecret } from "firebase-functions/params";

// RUNTIME_CONFIG is the default name set by the `firebase functions:config:export` command
const config = defineJsonSecret("RUNTIME_CONFIG");

export const myFunction = onRequest(
  // Bind secret to your function
  { secrets: [config] },
  (req, res) => {
    // Access secret values via .value()
    const apiKey = config.value().someapi.key;
    // ...
  }
);
```

### 3. Deploy Functions

Deploy your updated functions to apply the changes and bind the secret permissions.

```bash
firebase deploy --only functions:<your-function-name>
```

## 6. Update Runtime Options

Runtime options are now set directly within the function definition.

**Before (1st Gen):**

```typescript
export const func = functions
  .runWith({
    // Keep 5 instances warm
    minInstances: 5,
  })
  .https.onRequest((request, response) => {
    // ...
  });
```

**After (2nd Gen):**

```typescript
import { onRequest } from "firebase-functions/https";

export const func = onRequest(
  {
    // Keep 5 instances warm
    minInstances: 5,
  },
  (request, response) => {
    // ...
  }
);
```

## 7. Traffic Migration

A human should follow these steps to migrate safely:

1. Rename your new 2nd gen function with a different name.
2. Comment out any existing `minInstances` or `maxInstances` config in the new 2nd gen function and instead set `maxInstances` to `1` while testing.
3. Deploy it alongside the old 1st gen function.
4. Gradually introduce traffic to the new function (e.g., via client-side changes or by calling it from the 1st gen function).
5. As traffic ramps up to the new 2nd gen function, scale it up by adding back the original `minInstances` and `maxInstances` settings to the 2nd gen function. Reduce the `minInstances` and `maxInstances` settings for the 1st gen function as traffic decreases.
6. The 1st gen function can be deleted once it has stopped receiving traffic.