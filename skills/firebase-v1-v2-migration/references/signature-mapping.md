# Firebase Functions V1 vs V2 Signature Mapping

This reference maps legacy V1 functions to their modern V2 equivalents. It includes the **Shimmed Parameter Key** you should use when destructuring the V2 event object to preserve V1 business logic.

---

## 🔥 Cloud Firestore

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `firestore.document().onWrite()` | `onDocumentWritten()` | `change` | `({ change, context })` |
| `firestore.document().onCreate()` | `onDocumentCreated()` | `snapshot` | `({ snapshot, context })` |
| `firestore.document().onUpdate()` | `onDocumentUpdated()` | `change` | `({ change, context })` |
| `firestore.document().onDelete()` | `onDocumentDeleted()` | `snapshot` | `({ snapshot, context })` |

---

## 📨 Cloud Pub/Sub

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `pubsub.topic().onPublish()` | `onMessagePublished()` | `message` | `({ message, context })` |
| `pubsub.schedule().onRun()` | `scheduler.onSchedule()` | **N/A** | Access `event` directly |

> [!NOTE]
> Scheduled functions moved from the `pubsub` namespace to the `scheduler` namespace in V2.

---

## 💾 Realtime Database

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `database.ref().onWrite()` | `onValueWritten()` | `change` | `({ change, context })` |
| `database.ref().onCreate()` | `onValueCreated()` | `snapshot` | `({ snapshot, context })` |
| `database.ref().onUpdate()` | `onValueUpdated()` | `change` | `({ change, context })` |
| `database.ref().onDelete()` | `onValueDeleted()` | `snapshot` | `({ snapshot, context })` |

---

## 🗄️ Cloud Storage

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `storage.object().onArchive()` | `onObjectArchived()` | `object` | `({ object, context })` |
| `storage.object().onDelete()` | `onObjectDeleted()` | `object` | `({ object, context })` |
| `storage.object().onFinalize()` | `onObjectFinalized()` | `object` | `({ object, context })` |
| `storage.object().onMetadataUpdate()` | `onObjectMetadataUpdated()` | `object` | `({ object, context })` |

---

## 🌐 HTTP / Callables

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `https.onRequest()` | `https.onRequest()` | **N/A** | Standard Express `(req, res)` |
| `https.onCall()` | `https.onCall()` | **N/A** | Destructure `({ data, auth })` |

> [!IMPORTANT]
> **HTTP Callables do NOT use the Destructuring Shim.** 
> In V2, the handler receives a single `CallableRequest` object (not a `CloudEvent`). You should destructure properties like `data`, `auth`, and `app` directly from it. The traditional `context` object is **unavailable**.

---

## 🔑 Auth (Blocking)

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `auth.user().beforeSignIn()` | `identity.beforeUserSignedIn()` | **N/A** | Access `event` directly |
| `auth.user().beforeCreate()` | `identity.beforeUserCreated()` | **N/A** | Access `event` directly |

> [!NOTE]
> Auth Blocking triggers moved to the `identity` namespace in V2.

---

## ⏰ Cloud Tasks

| V1 Trigger | V2 Equivalent | Shimmed Key | Destructuring Pattern |
| :--- | :--- | :--- | :--- |
| `tasks.taskQueue().onDispatch()` | `tasks.onTaskDispatched()` | **N/A** | Access `event` directly |
