---
name: firebase-remote-config-basics
description: >-
  Integrates Firebase Remote Config client SDKs into Android and iOS apps. Use
  ONLY when adding firebase-config dependencies, setting XML/Plist in-app
  defaults (setDefaultsAsync/setDefaults), calling fetchAndActivate(), or adding
  real-time config listeners. For Remote Config templates, use
  firebase-remote-config-templates. Don't use for Xcode setup, CLI, AI, or Auth.
compatibility: >-
  Best used with Android (Gradle BoM) or iOS (Swift Package Manager) projects
  and the Firebase CLI (`npx -y firebase-tools@latest`).
metadata:
  author: Google LLC
  category: ApplicationDevelopment
---

# Firebase Remote Config Client SDK Onboarding (Android & iOS)

> [!IMPORTANT] **Remote Config Template Management (`remote_config.json`)**
> - **Do NOT read `firebase-remote-config-templates`** when the user only asks
>   for Android or iOS client SDK setup, `remote_config_defaults.xml`,
>   `RemoteConfigDefaults.plist`, `fetchAndActivate()`, or real-time listeners.
> - Only read `firebase-remote-config-templates` when the task explicitly asks
>   to fetch, validate, author, or deploy Remote Config JSON templates
>   (`parameters`, `conditions`, `condition order`, `parameterGroups`, or
>   version rollbacks).

This skill covers integrating the Firebase Remote Config client SDK into
**Android (Kotlin)** and **iOS (Swift)** applications, configuring in-app
default values, fetching and activating server values, and listening for
real-time template updates.

## Prerequisites

1. A Firebase project initialized with an Android (`google-services.json`) or
   iOS (`GoogleService-Info.plist`) app. See the `firebase-basics` skill for
   project initialization and `xcode-project-setup` for iOS target setup.
2. **Google Analytics** is recommended in client apps when using user-property,
   audience, or percentage-based conditions.

## 1. Platform SDK Setup Guides

Before writing or modifying client application code, read the platform-specific
reference guide for your target OS:

- **Android (Kotlin + Gradle BoM)**: Read
  [android_setup.md](references/android_setup.md)
- **iOS (Swift + Swift Package Manager)**: Read
  [ios_setup.md](references/ios_setup.md)

## 2. Core Client Integration Workflow

Every Android or iOS Remote Config integration must follow these five steps in
order:

1. **Add Dependencies**:
   - **Android**: Query Google Maven (`dl.google.com/dl/android/maven2/`) for
     the latest `firebase-bom` version and add
     `com.google.firebase:firebase-config` and
     `com.google.firebase:firebase-analytics` (never use deprecated `-ktx`
     coordinate suffixes or `.ktx` package imports).
   - **iOS**: Add `firebase-ios-sdk` via Swift Package Manager and link
     `FirebaseRemoteConfig` and `FirebaseAnalytics`.
2. **Obtain Singleton & Configure Fetch Settings**:
   - Use a relaxed `minimumFetchIntervalInSeconds` (e.g., `3600` seconds / 1
     hour in production; `0` only in local debug builds to avoid server
     throttling).
3. **Set In-App Defaults (`setDefaultsAsync` / `setDefaults`)**:
   - **Android**: Define `<defaultsMap>` entries in
     `app/src/main/res/xml/remote_config_defaults.xml` and call
     `remoteConfig.setDefaultsAsync(R.xml.remote_config_defaults)`.
   - **iOS**: Define keys in `RemoteConfigDefaults.plist` and call
     `remoteConfig.setDefaults(fromPlist: "RemoteConfigDefaults")`.
   - **Type Synchronization**: Ensure every key's in-app default format matches
     the parameter's `valueType` (`BOOLEAN`, `NUMBER`, `STRING`, `JSON`)
     and the typed getter used in code (`getBoolean`/`boolValue`,
     `getLong`/`getDouble`/`numberValue`, `getString`/`stringValue`).
   - **Flat Key Lookup**: Even if a parameter is organized inside a
     `parameterGroup`, client SDKs **always** read it by its flat `<param_key>`
     (e.g., `remoteConfig.getString("checkout_button_color")`), never prefixed
     by the group name.
4. **Fetch and Activate (`fetchAndActivate()`)**:
   - Call `fetchAndActivate()` to retrieve the latest evaluated values from the
     Remote Config backend and make them active in the current session.
5. **Attach Real-Time Listeners (`addOnConfigUpdateListener`)**:
   - Register a real-time config update listener and call `activate()` inside
     `onUpdate` when changed keys (`configUpdate.updatedKeys`) affect active
     screens. Remove the listener registration when the lifecycle scope ends
     (except for application-scoped singletons).

## 3. Recommended Client Loading Strategies

Choose the loading strategy that matches your app's UX latency requirements (see
[Loading Strategies](https://firebase.google.com/docs/remote-config/loading)):

- **Strategy 1: Fetch Now and Activate on Next Startup (Recommended Default)**:
  Activate previously downloaded values immediately on launch so UI renders
  without network delay, then trigger an asynchronous `fetch()` in the
  background to cache fresh values for the next app session.
- **Strategy 2: Fetch and Activate Behind a Loading Screen**:
  If a screen depends on fresh server configuration before first render, call
  `fetchAndActivate()` while showing a skeleton/splash state with a strict
  timeout fallback to in-app defaults.
- **Strategy 3: Real-Time Background Updates**:
  Combine startup `fetchAndActivate()` with `addOnConfigUpdateListener` so
  urgent feature-flag kill-switches propagate immediately while the app is in
  the foreground.
- **Anti-Patterns to Avoid**:
  - Never block the main/UI thread waiting for a network fetch without in-app
    defaults configured.
  - Never ship production builds with `minimumFetchIntervalInSeconds = 0`
    without real-time listeners, as rapid polling triggers client-side and
    server-side throttling.
  - Never mutate UI layout mid-interaction on a background `activate()` unless
    the screen explicitly supports reactive state updates.
