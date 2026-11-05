---
name: firebase-analytics
description: >-
  Comprehensive guide for Google Analytics for Firebase (GA4F), including base
  setup, SDK initialization, screen tracking, and event logging on Android and
  iOS. Use this skill when setting up Google Analytics, adding the SDK, or
  logging analytics events. Don't use for standalone CLI login or project/config
  file downloads without Analytics (use firebase-basics), or for Crashlytics,
  Remote Config, Auth, Firestore, Hosting, App Hosting, or Data Connect.
compatibility: >-
  This skill is best used with the Firebase CLI, but does not require it.
  Firebase CLI can be accessed through `npx -y firebase-tools@latest`.
version: 1.0.0
metadata:
  author: Google LLC
  category: CloudObservabilityAndMonitoring
---

# Firebase Analytics

This skill provides a complete guide for getting started with Google Analytics
for Firebase (GA4F) on Android or iOS. It covers base dependency setup,
configuration file placement, initialization, screen tracking, and real-time
event verification.

## Prerequisites

An active Firebase project
[linked to a Google Analytics property](https://support.google.com/analytics/answer/9289234).
See the `firebase-basics` skill for references on project initialization, CLI
login, and downloading app configuration files (`google-services.json` or
`GoogleService-Info.plist`).

## SDK Setup

To learn how to set up Google Analytics for Firebase in your application code
and verify events in real time with DebugView, choose your platform:

*   **Android**: [android_setup.md](references/android_setup.md)
*   **iOS**: [ios_setup.md](references/ios_setup.md)

## SDK Usage

Google Analytics for Firebase automatically logs some events and user
properties; you can also define custom events and properties.

*   [Log events (custom or recommended)](https://firebase.google.com/docs/analytics/events)
*   [Set user properties](https://firebase.google.com/docs/analytics/user-properties)
*   Track screens
    *   **Android**:
        [android_screen_views.md](references/android_screen_views.md)
    *   **iOS**: [ios_screen_views.md](references/ios_screen_views.md)
*   [Configure data collection and consent mode](https://firebase.google.com/docs/analytics/configure-data-collection)

To learn how to customize event logging and configure advanced behaviors,
consult the documentation for your platform.

*   **Android**:
    [Get started with Google Analytics for Android](https://firebase.google.com/docs/analytics/android/get-started)
*   **iOS**:
    [Get started with Google Analytics for iOS+](https://firebase.google.com/docs/analytics/ios/get-started)
