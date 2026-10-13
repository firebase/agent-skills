---
name: firebase-app-check
description: >-
  Enables setting up Firebase App Check for mobile and web applications to
  protect backend resources from abuse. Use when configuring App Check for
  iOS, Android, Web, or Flutter apps using default providers like
  DeviceCheck, App Attest, Play Integrity, and reCAPTCHA.
---

# Firebase App Check

## Overview

Firebase App Check helps protect your backend resources from abuse, such as
billing fraud and phishing, by ensuring that requests originate from your
authentic app.

This skill provides guidance on setting up App Check with the default providers
for various platforms.

## Platform Setup Guides

Select the guide for your platform:

-   **iOS**: See [ios.md](references/ios.md) for DeviceCheck and App Attest
    setup.
-   **Android**: See [android.md](references/android.md) for Play Integrity
    setup.
-   **Web**: See [web.md](references/web.md) for reCAPTCHA setup.
-   **Flutter**: See [flutter.md](references/flutter.md) for Flutter-specific
    integration.

## General Principles

-   **Enforcement**: Do not enable enforcement until you have monitored metrics
    and verified that legitimate users will not be blocked.
-   **Debug Provider**: Always use the debug provider for local development and
    CI environments to avoid depleting quotas and blocking access.

## Resources

### references/

-   [ios.md](references/ios.md): iOS setup details.
-   [android.md](references/android.md): Android setup details.
-   [web.md](references/web.md): Web setup details.
-   [flutter.md](references/flutter.md): Flutter setup details.
