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
- `[references/nextjs.md](./references/nextjs.md)` - For Next.js App Router (RSCs, Route Handlers).
- `[references/remix.md](./references/remix.md)` - For Remix (`loader` / `action` functions).
- `[references/angular-ssr.md](./references/angular-ssr.md)` - For Angular Universal/SSR (`REQUEST` token and `TransferState`).

*Note: If the user's framework is not explicitly listed (e.g., SvelteKit, Nuxt), read `nextjs.md` mentally translating Next-specific concepts (like `headers()`) to the equivalent request handling method corresponding to their actual framework.*

---

## Core Principles

Regardless of the framework selected in Step 2, you must aggressively enforce the following core principles.

### 1. Initializing Firebase: Avoid the Singleton

In a Node.js SSR context, utilizing the single `initializeApp` singleton is extremely dangerous because the server instance is shared across all incoming requests globally.

> [!WARNING]
> DO NOT use the standard `initializeApp()` inside server-side code that responds to HTTP endpoints or renders pages. It will cause severe data and authentication token leakage between different users.

Instead, use `initializeServerApp` to create a lightweight, request-scoped Firebase app instance. You can pass both the user's Auth ID token and an App Check token (if enabled) to authenticate the server-side requests on behalf of the client.

```typescript
import { initializeServerApp } from "firebase/app";

// Must be called for every incoming request handling routine
const app = initializeServerApp(firebaseConfig, {
  authIdToken: extractedToken, // Provided by framework-specific headers
  appCheckToken: extractedAppCheckToken // Optional, provided by framework-specific headers if App Check is enabled
});
```

### 2. Firestore Serialization Requirements

Data from `getFirestore` contains complex prototype objects (like `Timestamp`, `DocumentReference`, and `GeoPoint`) which cannot be natively serialized into JSON strings across network boundaries.

Always map over fetched Firestore documents to extract and convert these specific types to their serializable equivalents (such as `.toDate().toISOString()`) *before* returning them from the server component/loader.

### 3. Data Connect Serialization Differences

Unlike Firestore, Firebase Data Connect utilizes standard GraphQL over its protocol. Responses to generated query functions are immediately returned as perfectly serializable JSON primitives.

Data fetched via Data Connect Server SDKs (`executeGraphql` or generated SDKs like `@firebasegen/default-connector`) does not require manual conversion of structures before being passed as page props or signals.

### 4. Other Firebase Products (RTDB, Storage, Functions)

The `initializeServerApp` pattern is not limited to Firestore; you can safely initialize the client SDKs for Realtime Database, Cloud Storage, and Cloud Functions on the server. Because the app instance is authenticated via `authIdToken`, these calls will securely interact with Firebase infrastructure using the requesting user's identity.
- **Realtime Database**: Data returned from `get(ref(db, 'path'))` is already primitively structured (JSON serializable).
- **Cloud Storage**: You can safely fetch download URLs utilizing `getDownloadURL(ref(storage, 'path'))` on the server.
- **Cloud Functions**: You can securely execute callable functions using `httpsCallable(functions, 'name')(data)` on the server on behalf of the user.

### 5. Resuming Server Context in the Client

Once you have initialized the server app and fetched data, it is a best-practice to seamlessly "resume" this state in the CSR (Client-Side Rendering) environment without generating a layout shift or making redundant network requests:

- **Firebase Auth Hydration**: Instead of rendering a blank or unauthenticated state while `onAuthStateChanged` initializes the client Firebase Auth SDK, pass the parsed user data (obtained from the decoded session cookie) as an initial property (e.g. `initialUser` prop in React, or via `TransferState` in Angular) to your client-side Auth Provider.
- **Firestore `onSnapshotResume`**: In Firebase JS v10+, if you initiate a Firestore query on the server (using `getDocs()` or `getDoc()`), you can pass the `.toJSON()` representation of that snapshot to the client. The client can then call `onSnapshotResume(db, serializedSnapshot, ...)` to immediately resume the listener from the server's state, preventing the client from re-downloading the initial snapshot.
- **Data Connect `subscribe`**: When executing generated queries on the server (e.g., `listMovies()`), the returned result object exposes a `.toJSON()` function. By passing this serialized representation to the client, you can hydrate initial UI state and supply it directly into the generated `subscribe(serializedQuery, ...)` function to resume watching for cache updates without re-triggering the initial query.
