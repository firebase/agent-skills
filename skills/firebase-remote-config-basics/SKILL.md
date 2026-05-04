---
name: firebase-remote-config-basics
description: Comprehensive guide for Firebase Remote Config, including template management and SDK usage. Use this skill when the user needs help setting up Remote Config, managing feature flags, or updating app behavior dynamically.
compatibility: This skill is best used with the Firebase CLI, but does not require it. Firebase CLI can be accessed through `npx -y firebase-tools@latest`.
---

# Remote Config

This skill provides a complete guide for getting started with Remote Config on Android or iOS. Remote Config allows you to change the behavior and appearance of your app without publishing an app update by maintaining a cloud-based configuration template.

## Prerequisites

Provisioning Remote Config requires both a Firebase project and a Firebase app, either Android or iOS. To manage the Remote Config template and conditions via the command line, use the Firebase CLI. See the `firebase-basics` skill for references on project initialization.

## SDK Setup

To learn how to setup Remote Config in your application code, choose your platform:

*   **Android**: [android_setup.md](references/android_setup.md)
*   **iOS**: [ios_setup.md](references/ios_setup.md)

## SDK Usage

The SDK provides a number of features to make your application dynamic and responsive to user segments.

* **Set In-App Defaults**: Define baseline values to ensure the app functions offline or before the first fetch.
* **Fetch and Activate**: Retrieve values from the Firebase backend and apply them to the local UI/Logic.
* **Real-time Updates**: Listen for server-side configuration changes to update the app instantly without a refresh.
* **Template Management**: Use the Firebase CLI to version-control, get, and deploy your config JSON files.

To learn how to implement advanced targeting, conditions, and A/B testing, consult the documentation for your platform.

*   **Android**: [Get started with Firebase Remote Config on Android](https://firebase.google.com/docs/remote-config/get-started?platform=android)
*   **iOS**: [Get started with Firebase Remote Config on Apple Platforms](https://firebase.google.com/docs/remote-config/get-started?platform=ios)