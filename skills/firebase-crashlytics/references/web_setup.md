# Firebase Crashlytics - Web Setup Guide

This guide details the setup and configuration of Firebase Crashlytics for web
applications.

Important references:

- Refer to `skills/firebase-basics/references/web_setup.md` for project
  creation, registering a web app, and initializing the core Firebase app.
- Refer to the
  [Get started with Firebase Crashlytics for Web](https://firebase.google.com/docs/crashlytics/web/get-started)
  guide for detailed configuration, architecture, and framework documentation.

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
  [Step 2: Add and initialize the SDK in your app](https://firebase.google.com/docs/crashlytics/web/get-started#add-sdk)
  and `skills/firebase-basics/references/web_setup.md`.

______________________________________________________________________

## 3. Framework-Specific Setup Guides

Refer to the framework-specific guide corresponding to your app:

- **[Next.js Setup Guide](https://firebase.google.com/docs/crashlytics/web/get-started#configure-automatic-error-capturing)**:
  Wrap `<CrashlyticsRoutes>` from `firebase/crashlytics/next-navigation` inside
  a Client Component (`"use client"`), then wrap your root App Router layout.
- **[React Setup Guide](https://firebase.google.com/docs/crashlytics/web/get-started#configure-automatic-error-capturing)**:
  Wrap root application components with `<FirebaseCrashlytics>` from
  `firebase/crashlytics/react`.
- **[React Router Setup Guide](https://firebase.google.com/docs/crashlytics/web/get-started#configure-automatic-error-capturing)**:
  Replace React Router's `<Routes>` container with `<CrashlyticsRoutes>` from
  `firebase/crashlytics/react-router` for parameterized path tracking.
- **[TanStack Router Setup Guide](https://firebase.google.com/docs/crashlytics/web/get-started#configure-automatic-error-capturing)**:
  Initialize with `getCrashlytics(app)` and bind error logging in
  `defaultOnCatch` using `recordError()`.
- **[Angular Setup Guide](https://firebase.google.com/docs/crashlytics/web/get-started#configure-automatic-error-capturing)**:
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

Reference:
[Get readable crash reports (Web)](https://firebase.google.com/docs/crashlytics/web/get-deobfuscated-reports).

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
[Test your implementation (Web)](https://firebase.google.com/docs/crashlytics/web/test-implementation#force-test-crash).

______________________________________________________________________

## 6. Debugging with AI Agents

AI coding agents can assist with investigating web crashes:

- **MCP Tools (`crashlytics:connect`)**: Guided workflow prompt to query issues,
  inspect de-obfuscated sourcemaps against local code, and draft fixes (see
  [Crashlytics AI assistance with MCP](https://firebase.google.com/docs/crashlytics/ai-assistance-mcp)).
- **REST API & Telemetry Metadata**: Programmatically query issues via the
  [Firebase Crashlytics REST API](https://firebase.google.com/docs/reference/crashlytics/rest)
  using web dimensions (`browser.platform`, `user_agent.*`). See
  [Web browser metadata](https://firebase.google.com/docs/crashlytics/cloud-logging-schema#browser-metadata).

______________________________________________________________________

## 7. Additional Configuration & References

Consult the official Crashlytics documentation for advanced configurations:

- **[Customize Crash Reports (Web)](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports)**:
  - **[App Versioning](https://firebase.google.com/docs/crashlytics/web/get-started#set-app-version)**:
    Automate telemetry version tagging using the `crashlytics-setconstants`
    build script helper.
  - **[Programmatic Error Capturing](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports#log-excepts)**:
    Manually record handled errors with custom key/value metadata using
    `recordError()`.
  - **[Force Flushing](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports#flush-telemetry-records)**:
    Flush in-memory buffered records immediately before page unload using
    `flush()`.
  - **[Best Practices & Gotchas](https://firebase.google.com/docs/crashlytics/troubleshooting#platform-support-web)**:
    Import guidelines and framework integration tips.
- **[Configuration Guide](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports)**:
  - **[Alerting](https://firebase.google.com/docs/crashlytics/alerts-default)**:
    Configure email alerts for new and regressed issues via Firebase Console,
    CLI (`crashlyticsWebAlerts`), or Cloud Monitoring.
  - **[Sampling](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports#sampling)**:
    Control Cloud Logging volume and costs via Console sampling slider, Firebase
    Telemetry Admin API (`PATCH`), or Cloud Logging exclusion filters.
  - **[Force 100% Sampling for Debugging](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports#sampling)**:
    Override sampling locally during development via
    `self.FIREBASE_TELEMETRY_DEBUG = true`.
  - **[Enable/Disable Telemetry Collection](https://firebase.google.com/docs/crashlytics/web/customize-crash-reports#disable-or-enable-telemetry)**:
    Programmatically toggle collection with Telemetry Admin API `:enable` and
    `:disable` methods.
  - **[Log Schema](https://firebase.google.com/docs/crashlytics/cloud-logging-schema#log-schema)**:
    Field definitions and payload structures for Cloud Logging telemetry
    records.
