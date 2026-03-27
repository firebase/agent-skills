---
name: firebase-firestore-enterprise-native-mode
description: Comprehensive guide for Firestore enterprise native including provisioning, data model, security rules, and SDK usage. Use this skill when the user needs help setting up Firestore Enterprise with the Native mode, writing security rules, or using the Firestore SDK in their application.
compatibility: This skill is best used with the Firebase CLI, but does not require it. Install it by running `npm install -g firebase-tools`. 
---

# Firestore Enterprise Native Mode

This skill provides a complete guide for getting started with Firestore Enterprise Native Mode, including provisioning, data model, security rules, and SDK usage.

## Provisioning

To set up Firestore Enterprise Native Mode in your Firebase project and local environment, see [provisioning.md](references/provisioning.md).

## Data Model

To learn about Firestore data model and how to organize your data, see [data_model.md](references/data_model.md).

## Security Rules

For guidance on writing and deploying Firestore Security Rules to protect your data, see [security_rules.md](references/security_rules.md).

## SDK Usage

To learn how to use Firestore Enterprise Native Mode in your application code, see:
- [Web SDK Usage](references/web_sdk_usage.md)
- [Python SDK Usage](references/python_sdk_usage.md)

## iOS Development Rules (Standard Across All Firestore Editions)

When using Firestore Enterprise in an iOS app, you MUST follow these critical safety rules:

### ⛔️ CRITICAL RULE: INITIALIZATION ORDER ⛔️
You **MUST** ensure `FirebaseApp.configure()` is called in your `App.init()` **BEFORE** any Firestore-dependent state objects are initialized. Declaring a `@State` or `@StateObject` that touches Firestore at the root `App` level will cause a fatal crash. Refer to the `firebase-basics` skill for the "Safe Pattern."

### ⛔️ CRITICAL RULE: NO FirebaseFirestoreSwift ⛔️
UNDER NO CIRCUMSTANCES should you import or link against `FirebaseFirestoreSwift`. All Swift features (Codable, `@DocumentID`) are now in the main `FirebaseFirestore` module (v11+).

## Indexes

Indexes help improve query performance and speed up slow queries. For checking index types, query support tables, and best practices, see [indexes.md](references/indexes.md).
