# Firebase-Specific Security Checklist

Use alongside [sast-checklist.md](sast-checklist.md). These are the issues that
most often turn a fast-moving Firebase prototype into a data breach. The core
mental model:

> **Client SDK traffic is only protected by Security Rules (and App Check).
> Server code using the Admin SDK bypasses rules entirely and must do its own
> authentication and authorization.**

Official references: [Security Rules](https://firebase.google.com/docs/rules),
[Insecure rules](https://firebase.google.com/docs/firestore/security/insecure-rules),
[App Check](https://firebase.google.com/docs/app-check),
[Callable functions auth](https://firebase.google.com/docs/functions/callable),
[API keys for Firebase](https://firebase.google.com/docs/projects/api-keys),
[Data Connect authorization](https://firebase.google.com/docs/data-connect/authorization-and-security),
[App Hosting secrets](https://firebase.google.com/docs/app-hosting/configure#secret-parameters).

## A. Firestore Security Rules (`firestore.rules`)

| Check                               | Vulnerable pattern                                                                                                    | Typical severity         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Open access                         | `allow read, write: if true;` or `allow read, write;`                                                                 | Critical                 |
| Test mode left on                   | `allow read, write: if request.time < timestamp.date(...)`                                                            | Critical (before expiry) |
| Any signed-in user                  | `allow read, write: if request.auth != null;` on user data (anyone can create an account, including anonymous auth)   | High/Critical            |
| Missing ownership                   | `match /users/{userId}` without `request.auth.uid == userId`                                                          | High                     |
| Authority from client data          | `request.resource.data.role == 'admin'` / `resource.data.isAdmin` that the user can write                             | Critical                 |
| Update bypass                       | Validation only on `create`, not on `update`                                                                          | High                     |
| Overlapping matches                 | A permissive `match /{document=**}` anywhere grants access - rules are OR'd and cannot be revoked by a stricter match | Critical                 |
| `list` vs `get`                     | `allow read` where only `get` is intended exposes whole-collection enumeration                                        | Medium/High              |
| PII exposure                        | Public/blanket-auth readable docs containing email, phone, address                                                    | Medium/High              |
| No validation                       | No type/size checks -> data corruption, storage abuse                                                                 | Low/Medium               |
| Admin by email without verification | `request.auth.token.email == 'x'` without `email_verified == true`                                                    | High                     |

**Rules are not filters**: if a client query could return a doc the rules deny,
the whole query fails. A fix that adds ownership checks must keep client queries
constrained (`where('ownerId', '==', uid)`), or the app breaks.

## B. Cloud Storage rules (`storage.rules`)

- Whole-bucket `allow read, write: if request.auth != null;` or `if true`.
- No `request.resource.size < N` and `request.resource.contentType.matches(...)`
  on writes -> malware hosting, storage-cost abuse, stored XSS via `text/html`
  uploads served from your domain.
- Missing path ownership (`/users/{uid}/{file}` with `request.auth.uid == uid`).
- Download URLs from `getDownloadURL()` are bearer capabilities - storing them
  in a publicly readable Firestore doc makes the file public.

## C. Realtime Database rules (`database.rules.json`)

- `".read": true` / `".write": true` or `"auth != null"` at the root.
- Grants cascade downward and **cannot be revoked by child rules**.
- Missing `.validate` on writable nodes.

## D. Deployed vs local rules drift

If the Firebase MCP server is available, fetch deployed rules with
`firebase_get_security_rules` and diff against local files. Deployed rules that
are more permissive than the repo are a finding ("fix exists locally but was
never deployed"). Validate edited rules with `firebase_validate_security_rules`.

## E. Cloud Functions / server code (Admin SDK = no rules)

- **HTTP functions (`onRequest`)** are publicly invokable by default. Each must
  verify the caller: `Authorization: Bearer <ID token>` ->
  `getAuth().verifyIdToken(token)`, or session cookies via
  `verifySessionCookie(cookie, true)`. Decoding a JWT without verifying it is an
  auth bypass.
- **Callable functions (`onCall`)**: must check `request.auth` (v2) /
  `context.auth` (v1) **and** authorise against the resource. Trusting
  `request.data.uid` / `req.body.userId` instead of the verified uid is IDOR.
- `cors: true` / `Access-Control-Allow-Origin: *` on endpoints that use cookies
  or perform state changes.
- `enforceAppCheck: true` missing on functions that are expensive (AI, email,
  SMS, payments) -> abuse/denial-of-wallet.
- **Firestore-triggered privilege escalation**: a trigger copying a
  user-writable field (`role`, `plan`) into custom claims or another trusted
  collection.
- Secrets: hardcoded keys or `functions.config()` values in code; prefer
  `defineSecret()` / Cloud Secret Manager. Functions `.env` files committed with
  real secrets.
- Webhooks (Stripe, etc.) without signature verification.

## F. Next.js / web frameworks on App Hosting or Hosting

- **Server Actions and route handlers are public POST/GET endpoints.** Each must
  authenticate and authorise; hiding a button is not authorization.
- Auth enforced only in `middleware.ts` (bypassable in vulnerable Next.js
  versions; also skipped by some matchers) - require checks in the handler too.
- `NEXT_PUBLIC_*`, `VITE_*`, `EXPO_PUBLIC_*`, `REACT_APP_*` values are bundled
  into client JS - any secret there is leaked.
- `apphosting.yaml`: secret-like env vars set with `value:` instead of
  `secret:`; secrets with `availability: [BUILD]` that end up in client bundles.
- Admin SDK or service-account JSON imported from a module that is also imported
  by a client component.
- `firebase.json` Hosting `public` directory containing `.env`, source maps,
  backups or service-account files (Hosting serves everything in it). Missing
  security headers (`Content-Security-Policy`, `X-Content-Type-Options`,
  `frame-ancestors`/`X-Frame-Options`) is Low unless there is an XSS sink.

## G. Firebase Authentication

- Authorization decided purely client-side (`if (user.email === 'admin@...')` in
  React) with no rules/server check.
- Custom claims set from user-controlled input.
- Anonymous auth enabled + rules that only check `request.auth != null`.
- Session/ID tokens stored in `localStorage` alongside an XSS sink.
- Sign-in redirect URLs/authorized domains: open redirects in `continueUrl`
  handling.

## H. App Check

- Not initialised in the client, or not enforced for Firestore, Storage,
  Functions, or AI Logic.
- App Check **debug token** hardcoded or
  `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` shipped in production builds.

## I. AI features (Firebase AI Logic, Genkit, Gemini API)

- Gemini Developer API key (or OpenAI/Anthropic key) used directly from client
  code. Use Firebase AI Logic (proxied, App Check-protected) or a server
  endpoint.
- Genkit flows deployed with `onCallGenkit` / `onFlow` without an auth policy or
  App Check.
- Untrusted content (user docs, web pages, uploads) concatenated into prompts of
  a model that has tools with Admin SDK, file, or network access.
- LLM output written to Firestore and later rendered as HTML (stored XSS) or
  used in queries/commands.
- No per-user rate limit / quota on AI endpoints.

## J. Data Connect (`dataconnect/**/*.gql`)

- `@auth(level: PUBLIC)` on mutations, or on queries returning PII.
- `@auth(level: USER)` without filtering by `auth.uid` (e.g.
  `where: { ownerId: { eq_expr: "auth.uid" } }`) lets any signed-in user act on
  any row.
- `insecureReason:` acknowledgements - review each one.
- Native SQL built from variables.

## K. Secrets and config files

| File                                                                                                                | Secret?                                               |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `firebaseConfig` (`apiKey: "AIza..."`), `google-services.json`, `GoogleService-Info.plist`, `firebase_options.dart` | **No** - public identifiers. Do not report.           |
| Service account JSON (`"type": "service_account"`, `private_key`)                                                   | **Yes** - Critical if committed or shipped.           |
| `.env`, `.env.local`, `functions/.env`, `.secret.local` tracked by git                                              | **Yes** if they contain real secrets.                 |
| Remote Config parameters                                                                                            | Readable by every client - never store secrets there. |
| Legacy FCM server key in client code                                                                                | **Yes**.                                              |

The Firebase web API key is not a secret, **but** if the Gemini (Generative
Language) API or other billable Google APIs are enabled on the same project, an
unrestricted browser key can be abused. Recommend
[API key restrictions](https://firebase.google.com/docs/projects/api-keys#apply-restrictions)
as a Low/Medium finding only when the code shows such an API in use.

## L. Firebase false-positive guardrails

Do **not** report:

- The `firebaseConfig` web API key or app config files (see K).
- Emulator-only code (`connectFirestoreEmulator`, `demo-*` project IDs) and
  `firestore.rules` used only by tests.
- Admin SDK usage in server code that is behind proper auth checks.
- `allow read: if true` on genuinely public, non-sensitive collections (e.g.
  published blog posts) when writes are locked down - mention it as
  informational only if the collection name suggests it is intended to be
  public.
