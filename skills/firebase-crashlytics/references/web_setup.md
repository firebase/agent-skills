# Firebase Crashlytics - Web Setup Guide

This guide details the setup and configuration of Firebase Crashlytics for web
applications.

Important references:

- Refer to `skills/firebase-basics/references/web_setup.md` for project
  creation, registering a web app, and initializing the core Firebase app.
- Refer to the
  [Firebase Crashlytics JS SDK README](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/README.md)
  for detailed configuration, architecture, and framework documentation.

## Prerequisites

- Ensure the Firebase project and web app are set up (see
  `skills/firebase-basics/references/web_setup.md`).
- **Firebase CLI**: Requires version **v15.19.1+**, authenticated
  (`firebase login`), and project set (`firebase use <PROJECT_ID>`).
- **Permissions & Billing**: Cloud project **Owner** or **Editor** role and
  **Blaze (pay-as-you-go)** billing enabled.

______________________________________________________________________

## 1. Configure Firebase / Cloud Project

Web Crashlytics leverages Cloud Logging and Cloud Storage under the hood. Use
the Firebase CLI to onboard your project and web app:

```bash
firebase crashlytics:onboard:web <YOUR_FIREBASE_APP_ID> --project <YOUR_FIREBASE_PROJECT_ID>
```

This automated command enables the required Telemetry APIs, provisions the
`firebase-telemetry` Cloud Logging bucket with Log Analytics enabled, configures
routing sinks, and sets up alerts.

______________________________________________________________________

## 2. Install Packages & Initialize SDK

Install the Firebase package:

```bash
npm install firebase
```

- **Initialize Firebase**: Set up your `FirebaseApp` singleton following
  [Step 2: Core SDK Installation & Initialization](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/README.md#step-2-core-sdk-installation--initialization)
  and `skills/firebase-basics/references/web_setup.md`.

______________________________________________________________________

## 3. Framework-Specific Setup Guides

Refer to the framework-specific guide corresponding to your app:

- **[Next.js Setup Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/src/next/README.md)**:
  Wrap `<CrashlyticsRoutes>` from `firebase/crashlytics/next-navigation` inside
  a Client Component (`"use client"`), then wrap your root App Router layout.
- **[React Setup Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/src/react/README.md)**:
  Wrap root application components with `<FirebaseCrashlytics>` from
  `firebase/crashlytics/react`.
- **[React Router Setup Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/src/react-router/README.md)**:
  Replace React Router's `<Routes>` container with `<CrashlyticsRoutes>` from
  `firebase/crashlytics/react-router` for parameterized path tracking.
- **[TanStack Router Setup Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/src/tanstack/README.md)**:
  Initialize with `getCrashlytics(app)` and bind error logging in
  `defaultOnCatch` using `recordError()`.
- **[Angular Setup Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/src/angular/README.md)**:
  Add `provideCrashlytics(() => app)` from `firebase/crashlytics/angular` to
  application providers in `app.config.ts`.

______________________________________________________________________

## 4. Stack Trace De-obfuscation (Source Map Uploading)

To display de-minified stack traces in the Crashlytics console, upload
production source maps using the Firebase CLI:

```bash
firebase crashlytics:sourcemap:upload \
  --project <YOUR_FIREBASE_PROJECT_ID> \
  --app <YOUR_FIREBASE_APP_ID> \
  --debug <BUILD_OUTPUT_DIRECTORY>
```

> [!CAUTION] Ensure `.map` files are deleted or are not publicly accessible in
> your hosted app to avoid leaking source code.

Pass `--clean` flag to remove local source maps after uploading.

______________________________________________________________________

## 5. Force a Test Crash & Verify

1. Add an on-demand crash trigger inside a user action handler (e.g., a button
   click):
   ```tsx
   <button onClick={() => { throw new Error("Test Crash"); }}>Trigger Test Crash</button>
   ```
1. Trigger the crash in the running web application.
1. Verify in the Firebase Console:
   - Navigate to
     `https://console.firebase.google.com/u/0/project/<YOUR_FIREBASE_PROJECT_ID>/crashlytics/app/web:<YOUR_FIREBASE_APP_ID>/issues`
   - Alternatively, verify using the `get_report` tool if the Firebase MCP
     server is installed.
1. Remove the test crash code once verified.

Reference:
[Step 4: Force an Initial Crash](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/README.md#step-4-force-an-initial-crash).

______________________________________________________________________

## 6. Debugging with AI Agents

AI coding agents can assist with investigating web crashes:

- **MCP Tools (`crashlytics:connect`)**: Guided workflow prompt to query issues,
  inspect de-obfuscated sourcemaps against local code, and draft fixes (see
  [Crashlytics AI assistance with MCP](https://firebase.google.com/docs/crashlytics/ai-assistance-mcp)).
- **REST API & Telemetry Metadata**: Programmatically query issues via the
  [Firebase Crashlytics REST API](https://firebase.google.com/docs/reference/crashlytics/rest)
  using web dimensions (`browser.platform`, `user_agent.*`). See
  [Debugging with AI Agents](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/README.md#debugging-with-ai-agents).

______________________________________________________________________

## 7. Additional Configuration & References

Consult the following guides in the SDK repository for advanced configurations:

- **[Advanced Usage Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/ADVANCED_USAGE.md)**:
  - **[App Versioning](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/ADVANCED_USAGE.md#app-versioning)**:
    Automate telemetry version tagging using the `crashlytics-setconstants`
    build script helper.
  - **[Programmatic Error Capturing](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/ADVANCED_USAGE.md#programmatic-error-capturing)**:
    Manually record handled errors with custom key/value metadata using
    `recordError()`.
  - **[Force Flushing](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/ADVANCED_USAGE.md#force-flushing-telemetry-records-flush)**:
    Flush in-memory buffered records immediately before page unload using
    `flush()`.
  - **[Best Practices & Gotchas](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/ADVANCED_USAGE.md#best-practices--gotchas)**:
    Import guidelines and framework integration tips.
- **[Configuration Guide](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/CONFIGURATION.md)**:
  - **[Alerting](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/CONFIGURATION.md#alerting)**:
    Configure email alerts for new and regressed issues via Firebase Console,
    CLI (`crashlyticsWebAlerts`), or Cloud Monitoring.
  - **[Sampling](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/CONFIGURATION.md#sampling)**:
    Control Cloud Logging volume and costs via Console sampling slider, Firebase
    Telemetry Admin API (`PATCH`), or Cloud Logging exclusion filters.
  - **[Force 100% Sampling for Debugging](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/CONFIGURATION.md#force-100-sampling-for-debugging-overrides)**:
    Override sampling locally during development via
    `self.FIREBASE_TELEMETRY_DEBUG = true`.
  - **[Enable/Disable Telemetry Collection](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/CONFIGURATION.md#enabledisable-telemetry-collection)**:
    Programmatically toggle collection with Telemetry Admin API `:enable` and
    `:disable` methods.
  - **[Log Schema](https://github.com/firebase/firebase-js-sdk/blob/crashlytics2/packages/crashlytics/docs/CONFIGURATION.md#log-schema)**:
    Field definitions and payload structures for Cloud Logging telemetry
    records.
