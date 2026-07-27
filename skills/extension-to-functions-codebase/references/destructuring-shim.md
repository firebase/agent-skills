# Architectural Deep Dive: Destructuring Compatibility Shim

The Destructuring Compatibility Shim is a **Zero-Touch Logic Migration**
pattern. It allows you to upgrade a function's infrastructure to V2 (and take
advantage of GCF 2nd Gen runtimes) without rewriting any of your internal
business logic.

______________________________________________________________________

## How it Works

When you migrate a V1 function to V2, the signature changes from two parameters
`(data, context)` to a single `CloudEvent` object.

Instead of manually rewriting all usages of `context.params` or `message.json`
inside the function, you use JavaScript's **Object Destructuring** in the
signature.

### Example Transformation

#### Step 1: Legacy V1

```typescript
export const processOrder = functions.pubsub.topic("orders").onPublish((message, context) => {
  const orderId = message.json.id;
  console.log(`Processing order ${orderId} at ${context.timestamp}`);
});
```

#### Step 2: Modern V2 + Shim

We change the trigger to `onMessagePublished`, and instead of accepting `event`,
we destructure `{ message, context }` directly:

```typescript
export const processOrder = onMessagePublished("orders", ({ message, context }) => {
  const orderId = message.json.id; // Legacy logic remains untouched!
  console.log(`Processing order ${orderId} at ${context.timestamp}`);
});
```

### Why This Works

The Firebase Functions SDK uses a utility called `addV1Compat` to attach these
properties via **Lazy Getters** on the `CloudEvent` object for standard event
triggers. When you attempt to destructure `{ message, context }` from the event,
the SDK transparently maps the V2 event properties back into V1-compatible
objects on the fly! This feature is available in modern V2 environments
supported by the SDK.

______________________________________________________________________

## Provider Mapping Examples

Here are the exact destructuring patterns for every supported V2 provider:

### 1. Cloud Firestore

- **Created / Deleted** triggers:
  ```typescript
  // V2: onDocumentCreated, onDocumentDeleted
  export const processDoc = onDocumentCreated("users/{id}", ({ snapshot, context }) => { ... });
  ```
- **Updated / Written** triggers:
  ```typescript
  // V2: onDocumentUpdated, onDocumentWritten
  export const processDoc = onDocumentUpdated("users/{id}", ({ change, context }) => { ... });
  ```

### 2. Cloud Storage

- **All** triggers (`onObjectFinalized`, `onObjectDeleted`, `onObjectArchived`,
  `onObjectMetadataUpdated`):
  ```typescript
  export const processFile = onObjectFinalized(({ object, context }) => { ... });
  ```

### 3. Realtime Database

- **Created / Deleted** triggers:
  ```typescript
  export const processData = onValueCreated("/users/{id}", ({ snapshot, context }) => { ... });
  ```
- **Updated / Written** triggers:
  ```typescript
  export const processData = onValueWritten("/users/{id}", ({ change, context }) => { ... });
  ```

### 4. Remote Config

- **Updated** triggers:
  ```typescript
  export const processConfig = onConfigUpdated(({ version, context }) => { ... });
  ```

______________________________________________________________________

## Best Practices for AI Agents

1. **Rely on the shim for complex logic.** When converting functions with
   extensive or complex internal business logic, prefer using the destructuring
   shim (`{ shimmedKey, context }`) by default to minimize risk and avoid
   introducing subtle bugs.
1. **Clean-room rewrites.** If the function body is very simple, or if the user
   explicitly asks for a comprehensive code modernization/cleanup, you can ask
   the user if they would prefer a full clean-room rewrite to native V2 event
   properties.
1. **Always type-check (`tsc`) after the rewrite.** If the types are wrong, the
   shim might not be fully supported for that specific provider yet.
1. **HTTPS Callables (Flattened Context)**: Unlike event triggers, Callables do
   **not** use `V1Compat` or a `context` object. Instead, all context properties
   are flattened onto the request object.
   - **V1 Priority**: `(data, context) => { ... }`
   - **V2 Equivalent**: `({ data, auth, app }) => { ... }`

______________________________________________________________________

## Related Migrations

For a complete guide on migrating runtime options and `functions.config()` to V2
Parameterized Configuration, refer to
[configuration-migration.md](configuration-migration.md).
