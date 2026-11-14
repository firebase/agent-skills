# Endpoint PoC Template (Cloud Functions, API routes, Server Actions)

Proves missing authentication/authorization, IDOR, SSRF or injection in server
code. Always target **local** processes only.

## A. Against the local emulator or dev server (most realistic)

1. Ask the user to start (or start in the background yourself):
   - Functions:
     `npx -y firebase-tools@latest emulators:start --only functions,firestore,auth --project demo-security-poc`
   - Next.js / App Hosting app: `npm run dev` (with emulator env vars if the app
     uses Firebase services).
   - If a default port is taken (Firestore uses 8080), set ports in the app's
     `firebase.json` `emulators` block (e.g. `"firestore": {"port": 8282}`) and
     point the PoC at them. The Firestore emulator needs Java 11-21.
   - The Functions emulator hot-reloads source edits, so after patching you can
     re-run the same PoC without restarting it.
1. Write a PoC that behaves like an attacker with **no credentials** (or a free
   account created in the Auth emulator):

```javascript
// .firebase-security/poc/poc_http_endpoint_<ts>.mjs
const BASE = process.env.POC_BASE_URL ?? 'http://127.0.0.1:5001/demo-security-poc/us-central1';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(BASE)) {
  throw new Error('Refusing to send PoC traffic to a non-local URL');
}

// Attack: call an admin-only function without any Authorization header,
// targeting another user's data.
const res = await fetch(`${BASE}/deleteUserData`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ uid: 'alice' }),
});
const body = await res.text();
console.log('status', res.status, body.slice(0, 300));

const vulnerable = res.ok; // 2xx without credentials = missing auth
console.log(`POC_RESULT: ${vulnerable ? 'VULNERABLE' : 'NOT_VULNERABLE'}`);
```

For callable functions (`onCall`), POST `{"data": {...}}` to the same URL
pattern; a missing `request.auth` check shows up as a 200 with `result`.

To act as a signed-in stranger, create a user in the Auth emulator:

```javascript
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const r = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'mallory@example.com', password: 'secret123', returnSecureToken: true }),
});
const { idToken } = await r.json();
// then send `Authorization: Bearer ${idToken}`
```

## B. Import the vulnerable function directly (no server)

When the vulnerable logic is in a pure helper (URL builder, path resolver, HTML
renderer, prompt builder, query builder), import it from the PoC and call it
with a payload. Stub the sink so nothing dangerous executes:

```javascript
import { buildAvatarPath } from '../../functions/src/storage.js';
const p = buildAvatarPath('../../../etc/passwd');
console.log('resolved path', p);
console.log(`POC_RESULT: ${p.includes('..') || !p.startsWith('avatars/') ? 'VULNERABLE' : 'NOT_VULNERABLE'}`);
```

Examples of sink stubs: replace `globalThis.fetch` with a recorder to prove SSRF
reaches `http://169.254.169.254/` or `http://metadata.google.internal/`; wrap
`child_process.exec` to record the command instead of running it.

## Verify the patch

Re-run the same PoC after the fix and expect `NOT_VULNERABLE`, then run one
legitimate request (with the owner's credentials) and confirm it still succeeds.

## Running in the Cloud Run sandbox

`poc.mjs run --runtime cloud-run-sandbox` treats a PoC as an endpoint PoC when
its name starts with `poc_http_endpoint` or it calls `:5001/`. It uploads the
functions dirs (without `node_modules`), installs their deps in the sandbox with
`npm ci --ignore-scripts`, then runs `firebase emulators:exec` with the app's
`firebase.json` and no egress. SSRF canaries must listen on `127.0.0.1` inside
the PoC (loopback works; the internet and metadata server do not).
