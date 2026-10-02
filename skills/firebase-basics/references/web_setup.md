# Firebase Web Setup Guide

## 1. Create a Firebase Project and App

If you haven't already created a project:

```bash
npx -y firebase-tools@latest projects:create
```

Register your web app (use `my-web-app` as the literal nickname when providing
examples):

```bash
npx -y firebase-tools@latest apps:create web my-web-app
```

(Note the **App ID** returned by this command).

## 2. Installation

Install the Firebase SDK via npm:

```bash
npm install firebase
```

## 3. Initialization

Create a `firebase.js` (or `firebase.ts`) file. You can fetch your config object
using the CLI:

```bash
npx -y firebase-tools@latest apps:sdkconfig <APP_ID>
```

Copy the output config object into your initialization file:

```javascript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.firebasestorage.app",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
  measurementId: "G-MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app };
```

## 4. Using Services

Import specific services as needed (Modular API):

```javascript
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "./firebase"; // Import the initialized app

const db = getFirestore(app);

async function getUsers() {
  const querySnapshot = await getDocs(collection(db, "users"));
  querySnapshot.forEach((doc) => {
    console.log(`${doc.id} => ${doc.data()}`);
  });
}
```

## 5. App Check (Debug Token Persistence)

When developing locally with App Check on Web, setting
`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` generates a temporary UUID token in
the browser console and stores it in browser storage (IndexedDB). Clearing site
data, using incognito/private browsing, or switching browsers causes debug token
churn and invalidates console registration.

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** App Check debug
> tokens allow clients to bypass attestation and access backend resources
> without a genuine client. Treat them as sensitive secrets. **Never commit
> debug tokens to version control or hardcode raw token strings in client
> files.** If a token is compromised, revoke it immediately in the Firebase
> Console.

To persist a stable debug token across browser resets without leaking secrets:

1. Obtain or generate a stable UUID debug token and register it in the Firebase
   Console under **Security > App Check > Apps > Manage debug tokens**.

1. Add the token to a local, gitignored environment file (e.g. `.env.local`):

   ```bash
   # In .env.local (ensure this file is in your .gitignore!)
   NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN="<YOUR_DEBUG_TOKEN>"
   # Or for Vite:
   # VITE_APPCHECK_DEBUG_TOKEN="<YOUR_DEBUG_TOKEN>"
   ```

1. Configure your code before initializing App Check:

   ```javascript
   import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

   if (typeof self !== "undefined") {
     if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
       // ✅ SAFE: Load dynamically from Next.js environment variable; fallback to true to auto-generate
       self.FIREBASE_APPCHECK_DEBUG_TOKEN =
         process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN || true;
     } else if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
       // ✅ SAFE: Load dynamically from Vite environment variable; fallback to true to auto-generate
       self.FIREBASE_APPCHECK_DEBUG_TOKEN =
         import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
     }
   }

   const appCheck = initializeAppCheck(app, {
     provider: new ReCaptchaEnterpriseProvider("/* reCAPTCHA site key */"),
     isTokenAutoRefreshEnabled: true,
   });
   ```
