---
name: firebase-app-check
description: Guide developers through Firebase App Check setup and configuration for Web, including reCAPTCHA Enterprise and local debug tokens.
version: 1.0.0
---

# Firebase App Check

## Overview

Firebase App Check helps protect your API resources from abuse by preventing
unauthorized clients from accessing your backend services. It works with both
Firebase services and your own custom backends.

To use App Check, you must:

1.  Register your app with an attestation provider (e.g., reCAPTCHA Enterprise
    for Web).
2.  Initialize App Check in your application code.
3.  (Optional but recommended) Set up debug providers for local development.
4.  Enforce App Check in the Firebase Console.

## Required Agent Workflow

When a user asks to set up, configure, or help with Firebase App Check:

1.  **Inspect the Codebase**: You must first search for `initializeApp` to
    locate the Firebase initialization file (e.g., `main.js`, `index.js`, or
    `app.js`) and inspect its contents using `view_file` to understand the
    current configuration. Do not skip this step, even if the user only asks for
    a general guide.
2.  **Follow Setup Guide**: Use the details in the sections below to guide the
    user or modify the files.

## Setup & Initialization (Web)

### Step 1: Enable API & Generate Key (Google Cloud Console)

1.  Go to the Google Cloud Console.
2.  Enable the **reCAPTCHA Enterprise API** for your project.
3.  Navigate to **Security > reCAPTCHA Enterprise**.
4.  Create a new key for the **Website** platform. Instruct the user to specify
    their domains (including `localhost` for local development) and ensure the
    key type is reCAPTCHA Enterprise. You must also provide the user with the
    link to the
    [reCAPTCHA Enterprise documentation on creating a key for websites](https://docs.cloud.google.com/recaptcha/docs/create-key-website)
    for detailed instructions.

### Step 2: Register Provider (Firebase Console)

1.  Go to the Firebase Console.
2.  Navigate to **Build > App Check**.
3.  Go to the **Apps** tab, select your Web app, and click **Register**.
4.  Choose **reCAPTCHA Enterprise** as the provider and paste the Site Key
    generated in Step 1.

### Step 3: Initialize App Check in Code

Add the following to your application entry point (e.g., `main.js`), after
initializing Firebase App:

```javascript
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  // ... your config
  recaptchaSiteKey: "YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY"
};

const app = initializeApp(firebaseConfig);

// Initialize App Check
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(firebaseConfig.recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true
});
```

## Local Development & Debugging

During local development, App Check will fail by default unless `localhost` is
registered in reCAPTCHA (which has security implications for production keys) or
you use a debug provider.

The recommended way for local development is using the **Debug Provider**:

### Step 1: Enable Debug Mode in Code

Set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` **before** initializing App
Check.

> [!WARNING] **Critical Security Requirement:** Never deploy the debug token
> configuration to production. Always enable it conditionally.

Example of conditional enablement:

```javascript
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(firebaseConfig.recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true
});
```

### Step 2: Retrieve the Debug Token

1.  Run your app locally.
2.  Open the browser console (Developer Tools).
3.  Look for a log containing `App Check debug token: <UUID>`.
4.  Copy the UUID.

### Step 3: Register Debug Token in Firebase Console

1.  In the Firebase Console, go to **App Check > Apps**.
2.  Click the overflow menu (three vertical dots) next to your Web app.
3.  Select **Manage debug tokens**.
4.  Click **Add debug token**, paste the copied UUID, and save.

## Production Enforcement

Enabling App Check does not automatically block requests. You must manually
enforce it.

1.  In the Firebase Console, go to **App Check > APIs**.
2.  Monitor your traffic metrics to ensure legitimate users are sending valid
    tokens.
3.  Once ready, click **Enforce** for the services you want to protect (e.g.,
    Firestore, Realtime Database, Storage, Cloud Functions).
