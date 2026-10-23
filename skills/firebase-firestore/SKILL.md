---
name: firebase-firestore
description: >-
  Sets up, manages, queries, configures, and upgrades Cloud Firestore databases (Standard/Enterprise edition) and SDKs, including data modeling, security rules, indexes, SDK integrations (Web, Python, iOS, Android, Flutter), and SDK version resolution/upgrades (including Node.js, Go, Java, .NET, PHP, Ruby). Use when creating/listing Firestore databases, defining data models/indexes, writing SDK queries, or integrating and upgrading Firestore SDKs. For authoring or modifying Firestore Security Rules (firestore.rules), delegate to the firestore-rules-author subagent if subagent delegation is available, or use firestore-rules-creation otherwise. Don't use for Firebase Hosting, Data Connect, Auth, Storage/GCS, Crashlytics, Functions, or BigQuery.
compatibility: This skill is best used with the Firebase CLI, but does not require it. Firebase CLI can be accessed through `npx -y firebase-tools@latest`.
metadata:
  author: Google LLC
  category: Databases
---

# Cloud Firestore Database and Operations

> [!IMPORTANT] **Security Rules Authoring (`firestore.rules`)** Whenever your
> task requires creating, authoring, or modifying `firestore.rules`:
>
> - **If subagent delegation AND the `firestore-rules-author` subagent are
>   available**: delegate authoring `firestore.rules` to the
>   `firestore-rules-author` subagent rather than writing `firestore.rules`
>   directly in the main agent.
> - **If subagent delegation is unavailable** (e.g., subagents not enabled in
>   the IDE) **OR `firestore-rules-author` is not installed**: read and follow
>   the `firestore-rules-creation` skill to write `firestore.rules` directly.

Before setting up dependencies, writing data models, or configuring security
rules, you MUST always identify the Firestore instance edition.

## 1. Instance Selection and Edition Detection

Run the following command to list current Firestore databases:

```bash
npx -y firebase-tools@latest firestore:databases:list
```

### A. Instance Found

1. For each database found, inspect its edition and details:

   ```bash
   npx -y firebase-tools@latest firestore:databases:get <database-id>
   ```

1. Ask the user which database instance they wish to target or if they would
   prefer to create a new instance.

1. Once the target instance is established:

   - If the **`edition`** is `STANDARD`, follow the guides under
     `references/standard/`.
   - If the **`edition`** is `ENTERPRISE` or native mode, follow the guides
     under `references/enterprise/`.

### B. No Instance Found (or New Requested)

If no databases exist or the user requests a new one, default to provisioning an
**Enterprise** edition database and ask the user what location to use. Run
`npx -y firebase-tools@latest firestore:locations` to get the list of options.
Suggest colocating with other resources if applicable.

Once the location is determined, create the database:

```bash
npx -y firebase-tools@latest firestore:databases:create <database-id> --edition="enterprise" --location="<selected-location>"
```

Proceed with using the guides under `references/enterprise/`.

______________________________________________________________________

## 2. SDK Version Resolution & Upgrade Workflow

Skip this section for read-only/Q&A/snippet prompts, CLI-only questions, or
tasks that only touch `firestore.rules`, `firestore.indexes.json`, or
`firebase.json`.

- **Modifying application code in an existing repo with a pinned SDK**: Do
  **not** silently mutate the manifest or lockfile during unrelated code edits.
  If the manifest pins an outdated SDK or uses deprecated patterns (e.g., Web v8
  `firebase.firestore()`, Python positional `.where()`, Android `-ktx`, iOS
  `FirebaseFirestoreSwift`), complete the user's task and append a 1-line offer
  to upgrade using [sdk_versions.md](references/sdk_versions.md).
- **Adding Firestore, scaffolding a project, or fulfilling an upgrade request**:
  Never guess or hardcode memorized SDK versions. Read and follow
  [sdk_versions.md](references/sdk_versions.md) to query the live registry
  version via `curl`, update the manifest/lockfile across Web, Node.js, Python,
  Go, Java, Android, iOS, .NET, PHP, Ruby, and Flutter, and ask the user if they
  want to migrate any deprecated APIs associated with the version upgrade.

______________________________________________________________________

## 3. Specialized Guides

Based on the identified or created instance edition, open and read the
corresponding reference guides:

### Standard Edition (`references/standard/`)

- **Provisioning**: Read [provisioning.md](references/standard/provisioning.md)
- **Security Rules**: See the `firestore-rules-creation` skill
- **SDK Usage**: Read [web_sdk_usage.md](references/standard/web_sdk_usage.md),
  [android_sdk_usage.md](references/standard/android_sdk_usage.md),
  [ios_setup.md](references/standard/ios_setup.md), or
  [flutter_setup.md](references/standard/flutter_setup.md)
- **Indexes**: Read [indexes.md](references/standard/indexes.md)

### Enterprise Edition / Native Mode (`references/enterprise/`)

- **Provisioning**: Read
  [provisioning.md](references/enterprise/provisioning.md)

- **Data Model**: Read [data_model.md](references/enterprise/data_model.md)

- **Security Rules**: See the `firestore-rules-creation` skill

- **SDK Usage**:

  > [!CRITICAL] **Mandatory Reference Reading** Before writing or modifying any
  > application code for Firestore Enterprise Edition on one of the platforms
  > below, you **MUST** read the corresponding reference document to understand
  > specific architectural requirements and pipeline initialization patterns.

  Read [web_sdk_usage.md](references/enterprise/web_sdk_usage.md),
  [python_sdk_usage.md](references/enterprise/python_sdk_usage.md),
  [android_sdk_usage.md](references/enterprise/android_sdk_usage.md),
  [ios_setup.md](references/enterprise/ios_setup.md), or
  [flutter_setup.md](references/enterprise/flutter_setup.md)

- **Indexes**: Read [indexes.md](references/enterprise/indexes.md)
