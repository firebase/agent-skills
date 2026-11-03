# Security Rules PoC Template (Emulator)

Proves a Firestore / Storage / Realtime Database rules weakness by attempting
the attack against the **local emulator** with the project's real rules file.
Uses
[`@firebase/rules-unit-testing`](https://firebase.google.com/docs/rules/unit-tests)
v4+ and the modular `firebase` SDK.

Prerequisites: Node 18+, Java 11-21 for the emulators (the Firestore emulator
fails to start on Java 24+, which removed the Security Manager -
[JEP 486](https://openjdk.org/jeps/486); put a JDK 21 first on `PATH`). Install
PoC deps:

```bash
node <SKILL_DIR>/scripts/poc.mjs init --type firestore_rules --location "firestore.rules:12"
node <SKILL_DIR>/scripts/poc.mjs install --packages "@firebase/rules-unit-testing firebase"
```

`poc.mjs run` starts the emulator with `firebase emulators:exec` in the PoC dir
(project `demo-security-poc`, Firestore on port 8181, Storage 9199, RTDB 9009)
and sets `FIRESTORE_EMULATOR_HOST` etc., so `initializeTestEnvironment` finds it
automatically.

## Firestore template

```javascript
// .firebase-security/poc/poc_firestore_rules_<ts>.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
// Rules file of the app under test (two levels up from .firebase-security/poc/).
const RULES = fs.readFileSync(path.resolve(here, '../../firestore.rules'), 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-security-poc',
  firestore: { rules: RULES },
});

let vulnerable = false;
try {
  // 1. Seed realistic data as an admin (bypasses rules).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice'), {
      email: 'alice@example.com', role: 'user',
    });
  });

  // 2. Attack as a different identity.
  const attacker = testEnv.authenticatedContext('mallory'); // or unauthenticatedContext()
  const db = attacker.firestore();

  // Attack A: read someone else's PII.
  try {
    const snap = await getDoc(doc(db, 'users/alice'));
    console.log('[A] read /users/alice as mallory ->', JSON.stringify(snap.data()));
    vulnerable = true;
  } catch (e) {
    console.log('[A] read blocked:', e.code);
  }

  // Attack B: privilege escalation on own doc (create valid, update to admin).
  try {
    await setDoc(doc(db, 'users/mallory'), { email: 'm@example.com', role: 'user' });
    await updateDoc(doc(db, 'users/mallory'), { role: 'admin' });
    console.log('[B] mallory set role=admin on own profile');
    vulnerable = true;
  } catch (e) {
    console.log('[B] escalation blocked:', e.code);
  }
} finally {
  await testEnv.cleanup();
}

console.log(`POC_RESULT: ${vulnerable ? 'VULNERABLE' : 'NOT_VULNERABLE'}`);
```

Tailor the attacks to the finding - use the app's **real collection names and
document shapes** (read them from the client code) and the identity that matters
(`unauthenticatedContext()` for "anyone on the internet",
`authenticatedContext('uid', { email_verified: false })` for "any free
account").

## Storage template (differences only)

```javascript
import { ref, uploadString, getBytes } from 'firebase/storage';
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-security-poc',
  storage: { rules: fs.readFileSync(path.resolve(here, '../../storage.rules'), 'utf8') },
});
const storage = testEnv.authenticatedContext('mallory').storage();
// e.g. overwrite another user's file, or upload a 50 MB text/html "image"
await uploadString(ref(storage, 'users/alice/avatar.png'), '<script>alert(1)</script>', 'raw', { contentType: 'text/html' });
```

## Realtime Database template (differences only)

```javascript
import { ref, get, set } from 'firebase/database';
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-security-poc',
  database: { rules: fs.readFileSync(path.resolve(here, '../../database.rules.json'), 'utf8') },
});
const rtdb = testEnv.unauthenticatedContext().database();
const snap = await get(ref(rtdb, 'users'));
```

## Verify the patch

After `firebase-security-patcher` edits the rules file, re-run the **same** PoC
unchanged. Expect `POC_RESULT: NOT_VULNERABLE`. Then add one positive check
(e.g. `assertSucceeds(getDoc(doc(ownerDb, 'users/alice')))` as `alice`) to make
sure the fix did not lock out legitimate users.
