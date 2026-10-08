# Server-Side Access Control Remediation

Covers Cloud Functions (HTTP + callable), Next.js route handlers and Server
Actions, Express APIs on App Hosting/Cloud Run - anything using the **Admin SDK,
which bypasses Security Rules**.

## Strategy

1. **Authenticate** every request from a verified credential (ID token, session
   cookie, callable `request.auth`).
1. **Authorise** against the resource: the verified uid must own it or hold a
   role (custom claim).
1. **Never trust identity fields from the body/query** (`uid`, `userId`, `role`,
   `isAdmin`, `price`).
1. **Allow-list writable fields** (no `{...req.body}` into Firestore).
1. **Enforce App Check** on expensive or abuse-prone endpoints.

## Callable function (v2)

```javascript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const updateProfile = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const uid = request.auth.uid;                      // NOT request.data.uid
  const { displayName } = request.data ?? {};
  if (typeof displayName !== 'string' || displayName.length > 100) {
    throw new HttpsError('invalid-argument', 'Bad displayName.');
  }
  await getFirestore().doc(`users/${uid}`).update({ displayName }); // allow-listed field
  return { ok: true };
});
```

## HTTP function (v2 `onRequest`)

```javascript
import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

async function requireUser(req, res) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) { res.status(401).send('Unauthorized'); return null; }
  try {
    return await getAuth().verifyIdToken(m[1]);     // verifies signature + expiry
  } catch {
    res.status(401).send('Unauthorized'); return null;
  }
}

export const deleteMyData = onRequest({ cors: ['https://myapp.web.app'] }, async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  await deleteUserData(user.uid);                   // NOT req.body.uid
  res.json({ ok: true });
});

export const adminReport = onRequest(async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.admin !== true) { res.status(403).send('Forbidden'); return; }
  // ...
});
```

Prefer `onCall` over `onRequest` for app-internal APIs: auth and App Check
tokens are verified for you.

## Next.js Server Action / route handler

```typescript
'use server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';

async function currentUser() {
  const session = (await cookies()).get('__session')?.value;
  if (!session) throw new Error('UNAUTHENTICATED');
  return getAuth().verifySessionCookie(session, true); // checkRevoked
}

export async function deletePost(postId: string) {
  const user = await currentUser();
  const ref = db.doc(`posts/${postId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('authorId') !== user.uid) throw new Error('FORBIDDEN');
  await ref.delete();
}
```

Do not rely on `middleware.ts` alone for authorization; check in the action or
handler itself.

## Mass assignment

```javascript
// VULNERABLE
await db.doc(`users/${uid}`).set(req.body, { merge: true });
// SECURE
const { displayName, photoURL } = req.body;
await db.doc(`users/${uid}`).set({ displayName, photoURL }, { merge: true });
```

## Privilege escalation via triggers / custom claims

Only set custom claims from trusted admin code paths, never by copying a
user-writable Firestore field. If a roles document drives claims, lock it in
rules (`allow write: if false;` for clients).

## Client-side changes that pair with the fix

Clients must now send credentials: callable functions do this automatically via
`httpsCallable`; for `fetch`, add
`Authorization: Bearer ${await auth.currentUser.getIdToken()}`. For App Check,
initialise it in the client (`initializeAppCheck`) before enabling enforcement,
or legitimate traffic will be rejected.
