---
name: firebase-ssr
description: "How to use Firebase in Server-Side Rendering (SSR) environments. Make sure to use this skill whenever the user mentions Next.js, Nuxt, SvelteKit, Angular SSR, Remix, or any other server-side framework, or asks about initializeServerApp, session cookies, fetching data on the server, or serializing Firebase data between server and client."
---

# Firebase in SSR Environments

When building universal/SSR applications correctly, you must isolate Firebase apps to prevent cross-request state pollution and securely pass Firebase-specific data structures back to the client.

## Framework Selection Workflow

The core concepts of Firebase SSR (request isolation and serialization mappings) apply to all major backend JS frameworks, but the execution syntax drastically changes.

**Step 1:** Identify the SSR framework the user is building with.

**Step 2:** Read the appropriate framework-specific reference guide before attempting to implement Firebase integration.
- `[references/nextjs.md](file:///Users/mtewani/source/agent-skills/skills/firebase-ssr/references/nextjs.md)` - For Next.js App Router (RSCs, Route Handlers).
- `[references/remix.md](file:///Users/mtewani/source/agent-skills/skills/firebase-ssr/references/remix.md)` - For Remix (`loader` / `action` functions).
- `[references/angular-ssr.md](file:///Users/mtewani/source/agent-skills/skills/firebase-ssr/references/angular-ssr.md)` - For Angular Universal/SSR (`REQUEST` token and `TransferState`).

*Note: If the user's framework is not explicitly listed (e.g., SvelteKit, Nuxt), read `nextjs.md` mentally translating Next-specific concepts (like `headers()`) to the equivalent request handling method corresponding to their actual framework.*

---

## Core Principles

Regardless of the framework selected in Step 2, you must aggressively enforce the following core principles.

### 1. Initializing Firebase: Avoid the Singleton

In a Node.js SSR context, utilizing the single `initializeApp` singleton is extremely dangerous because the server instance is shared across all incoming requests globally.

> [!WARNING]
> DO NOT use the standard `initializeApp()` inside server-side code that responds to HTTP endpoints or renders pages. It will cause severe data and authentication token leakage between different users.

Instead, use `initializeServerApp` to create a lightweight, request-scoped Firebase app instance.

```typescript
import { initializeServerApp } from "firebase/app";

// Must be called for every incoming request handling routine
const app = initializeServerApp(firebaseConfig, {
  authIdToken: extractedToken // Provided by framework-specific headers
});
```

### 2. Firestore Serialization Requirements

Data from `getFirestore` contains complex prototype objects (like `Timestamp`, `DocumentReference`, and `GeoPoint`) which cannot be natively serialized into JSON strings across network boundaries.

Always map over fetched Firestore documents to extract and convert these specific types to their serializable equivalents (such as `.toDate().toISOString()`) *before* returning them from the server component/loader.

### 3. Data Connect Serialization Differences

Unlike Firestore, Firebase Data Connect utilizes standard GraphQL over its protocol. Responses to generated query functions are immediately returned as perfectly serializable JSON primitives.

Data fetched via Data Connect Server SDKs (`executeGraphql` or generated SDKs like `@firebasegen/default-connector`) does not require manual conversion of structures before being passed as page props or signals.
