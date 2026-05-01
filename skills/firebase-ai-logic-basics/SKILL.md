---
name: firebase-ai-logic-basics
description: Official skill for integrating Firebase AI Logic (Gemini API) into web applications. Covers setup, multimodal inference, structured output, and security.
version: 1.1.0
---

# Firebase AI Logic Basics

## Overview

Firebase AI Logic is a product of Firebase that allows developers to add gen AI to their mobile and web apps using client-side SDKs. You can call Gemini models directly from your app without managing a dedicated backend. 

## Setup & Initialization

### Prerequisites

- Before starting, ensure you have **Node.js 16+** and npm installed.
- Identify the platform: Android, iOS, Flutter or Web.

### Installation & Provisioning

> [!WARNING]
> **CRITICAL: Backend Provisioning Required**
> For all platforms (Flutter, Android, iOS, Web), you MUST run `npx firebase-tools init ailogic` to provision the service. `flutterfire configure` ONLY handles client configuration and does NOT enable the AI service, leading to `PERMISSION_DENIED` errors.

`npx -y firebase-tools@latest init # Choose AI logic`

This will automatically enable the Gemini Developer API in the Firebase console.

## Core Capabilities

- **Text-Only Generation**
- **Multimodal input**
- **Chat Session**
- **Streaming Responses**

## Initialization Code References

| Language, Framework, Platform | Gemini API provider | Context URL |
| :---- | :---- | :---- |
| Web Modular API | Gemini Developer API | firebase://docs/ai-logic/get-started  |
| iOS (Swift) | Gemini Developer API | [ios_setup.md](references/ios_setup.md) |
| Flutter (Dart) | Gemini Developer API | [flutter_setup.md](references/flutter_setup.md) |

**CRITICAL MODEL CONSTRAINTS:**
- **DEFAULT MODEL:** Always use **`gemini-2.5-flash`**.
- **FORBIDDEN MODEL:** **DO NOT USE `gemini-1.5-flash`**.

## References

[Web SDK code examples](references/usage_patterns_web.md)
[iOS SDK code examples](references/ios_setup.md)
[Flutter SDK code examples](references/flutter_setup.md)
[Android (Kotlin) SDK usage patterns](references/usage_patterns_android.md)
