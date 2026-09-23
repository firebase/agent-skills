---
name: firebase-auth-basics
description: Guide for setting up Firebase Authentication and FirebaseUI drop-in sign-in screens on Web, iOS, Android, and Flutter. Use when adding user sign-in, sign-up, password reset, social/OAuth providers, a login or auth UI, or user management to an app. Don't use for authoring Firestore or Storage security rules beyond `request.auth` checks.
compatibility: This skill is best used with the Firebase CLI, but does not require it. Firebase CLI can be accessed through `npx -y firebase-tools@latest`.
metadata:
  category: Identity
---

## Prerequisites

- **Firebase Project**: Created via
  `npx -y firebase-tools@latest projects:create` (see `firebase-basics`).
- **Firebase CLI**: Installed and logged in (see `firebase-basics`).

## Core Concepts

Firebase Authentication provides backend services, easy-to-use SDKs, and
ready-made UI libraries to authenticate users to your app.

### Users

A user is an entity that can sign in to your app. Each user is identified by a
unique ID (`uid`) which is guaranteed to be unique across all providers. User
properties include:

- `uid`: Unique identifier.
- `email`: User's email address (if available).
- `displayName`: User's display name (if available).
- `photoURL`: URL to user's photo (if available).
- `emailVerified`: Boolean indicating if the email is verified.

### Identity Providers

Firebase Auth supports multiple ways to sign in:

- **Email/Password**: Basic email and password authentication.
- **Federated Identity Providers**: Google, Facebook, Twitter, GitHub,
  Microsoft, Apple, etc.
- **Phone Number**: SMS-based authentication.
- **Anonymous**: Temporary guest accounts that can be linked to permanent
  accounts later.
- **Custom Auth**: Integrate with your existing auth system.

Google Sign In is recommended as a good and secure default provider.

### Tokens

When a user signs in, they receive an ID Token (JWT). This token is used to
identify the user when making requests to Firebase services (Realtime Database,
Cloud Storage, Firestore) or your own backend.

- **ID Token**: Short-lived (1 hour), verifies identity.
- **Refresh Token**: Long-lived, used to get new ID tokens.

## Workflow

### 1. Provisioning

#### Option 1. Enabling Authentication via CLI

Only Google Sign In, anonymous auth, and email/password auth can be enabled via
CLI. For other providers, use the Firebase Console.

Configure Firebase Authentication in `firebase.json` by adding an 'auth' block:

```
{
  "auth": {
  "authorizedDomains": ["localhost"],
    "providers": {
      "anonymous": true,
      "emailPassword": true,
      "googleSignIn": {
        "oAuthBrandDisplayName": "Your Brand Name",
        "supportEmail": "support@example.com"
      }
    }
  }
}
```

> [!NOTE] If the Google Sign-In popup opens and immediately closes with the
> error `[firebase_auth/unauthorized-domain]`, it means the domain is not
> authorized. For local development, ensure `localhost` is included in the
> **Authorized Domains** list in the Firebase Console or via the
> `authorizedDomains` field in `firebase.json`. **CRITICAL**: Do NOT include the
> protocol or port number in the Authorized Domains list (e.g., use `localhost`,
> NOT `http://localhost:9090`).

**CRITICAL**: After configuring `firebase.json`, you MUST deploy the auth
configuration to the Firebase backend for the changes to take effect. This is
essential for auth providers like Google Sign-In, email/password, etc. to
auto-generate the necessary OAuth clients for your app platforms. Run:

```bash
npx -y firebase-tools@latest deploy --only auth
```

#### Option 2. Enabling Authentication in Console

Enable other providers in the Firebase Console.

1. Go to the
   https://console.firebase.google.com/project/_/authentication/providers
1. Select your project.
1. Enable the desired Sign-in providers (e.g., Email/Password, Google).

### 2. Choose the Auth UI Approach

> [!IMPORTANT] **For Agents:** For every request to add or build a sign-in,
> sign-up, login, password-reset, or authentication flow, you MUST surface both
> UI approaches and ask the user which they want before planning or changing
> code:
>
> 1. **FirebaseUI** (recommended) — pre-built, maintained authentication screens
>    and flows.
> 1. **Direct Firebase Auth SDK integration** — for custom-designed screens, or
>    to wire auth into screens the app already has.

Briefly explain the tradeoffs when asking. Do not assume the user knows
FirebaseUI exists. Do not pick direct SDK integration merely because the project
uses Compose, SwiftUI, React, Angular, Flutter, or another framework supported
by that platform's FirebaseUI library.

Skip the question only when the user has already chosen: they asked for
FirebaseUI, asked for direct SDK integration or custom screens, or asked to wire
Firebase Auth into existing screens.

### 3. Direct Firebase Auth SDK Setup and Usage

Build authentication UI directly against the Auth SDK.

- **Web**: [references/client_sdk_web.md](references/client_sdk_web.md)
- **iOS (Swift)**: [references/ios_setup.md](references/ios_setup.md)
- **Android (Kotlin)**:
  [references/client_sdk_android.md](references/client_sdk_android.md)
- **Flutter**: [references/flutter_setup.md](references/flutter_setup.md)

### 4. Drop-in Auth UI with FirebaseUI

FirebaseUI ships pre-built sign-in screens handling sign-in, sign-up, password
reset, account linking, and MFA.

- **iOS (SwiftUI)**:
  [references/firebaseui_ios.md](references/firebaseui_ios.md)
- **Android (Compose)**:
  [references/firebaseui_android.md](references/firebaseui_android.md)
- **Web (React, Shadcn, Angular)**:
  [references/firebaseui_web.md](references/firebaseui_web.md)
- **Flutter**:
  [references/firebaseui_flutter.md](references/firebaseui_flutter.md)

Each reference above is a pointer, not a guide: it routes to that library's own
agent skill, or to its documentation where no skill exists.

Load and follow that source before planning or implementing the FirebaseUI flow.
Do not implement from the pointer reference, from memory, or from a library
README, which lags behind the library.

### 5. Security Rules

Secure your data using `request.auth` in Firestore/Storage rules.

See [references/security_rules.md](references/security_rules.md).
