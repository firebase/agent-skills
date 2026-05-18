# Firebase App Check Skill - Agent E2E Test Plan

## Prerequisites

**Read `SKILL.md` first** to understand the skill's purpose and available references.

This skill is documentation-only and does not include executable scripts or a CLI binary. Testing focuses on the agent's ability to retrieve and apply the correct information from the reference files.

---

## Test 1: iOS Setup Inquiry

**Prompt:** "I need to set up App Check for my iOS app. I'm targeting iOS 15. What provider should I use and how do I initialize it in Swift?"

**Verify:**
- The agent reads `references/ios.md`.
- The agent recommends using **App Attest** (since it's iOS 14+).
- The agent provides a Swift code snippet showing how to set `AppAttestProviderFactory`.

---

## Test 2: Android Setup Inquiry

**Prompt:** "How do I set up App Check for my Android app using the recommended provider? What do I need to do in the Google Play Console?"

**Verify:**
- The agent reads `references/android.md`.
- The agent identifies **Play Integrity** as the recommended provider.
- The agent mentions linking the Firebase project in the Google Play Console under App Integrity.

---

## Test 3: Web Setup Inquiry

**Prompt:** "I want to protect my web app with App Check using reCAPTCHA v3. How do I initialize it?"

**Verify:**
- The agent reads `references/web.md`.
- The agent provides a JavaScript code snippet using `ReCaptchaV3Provider`.
- The agent mentions that a site key is required.

---

## Test 4: Flutter Setup Inquiry

**Prompt:** "I'm building a Flutter app and want to enable App Check for Android and iOS. How do I do that in code?"

**Verify:**
- The agent reads `references/flutter.md`.
- The agent provides a Dart code snippet showing `FirebaseAppCheck.instance.activate`.
- The agent shows setting providers for both `androidProvider` and `appleProvider`.
