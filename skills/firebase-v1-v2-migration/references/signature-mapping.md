# Firebase Functions V1 vs V2 Function Mapping

This reference table maps legacy V1 functions to their modern V2 equivalents. Use this table to find the correct V2 function names when migrating.

| Category | V1 Function | V2 Function | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `auth.user().beforeSignIn()` | `identity.beforeUserSignedIn()` | **Available** | Renamed to `beforeUserSignedIn`. |
| **Auth** | `auth.user().beforeCreate()` | `identity.beforeUserCreated()` | **Available** | |
| **Auth** | `auth.user().beforeEmail()` | `identity.beforeEmailSent()` | **Available** | Renamed to `beforeEmailSent`. |
| **Auth** | `auth.user().beforeSms()` | `identity.beforeSmsSent()` | **Available** | |
| **Database** | `database.ref().onWrite()` | `database.onValueWritten()` | **Available** | |
| **Database** | `database.ref().onCreate()` | `database.onValueCreated()` | **Available** | |
| **Database** | `database.ref().onUpdate()` | `database.onValueUpdated()` | **Available** | |
| **Database** | `database.ref().onDelete()` | `database.onValueDeleted()` | **Available** | |
| **Firestore** | `firestore.document().onWrite()` | `firestore.onDocumentWritten()` | **Available** | |
| **Firestore** | `firestore.document().onCreate()` | `firestore.onDocumentCreated()` | **Available** | |
| **Firestore** | `firestore.document().onUpdate()` | `firestore.onDocumentUpdated()` | **Available** | |
| **Firestore** | `firestore.document().onDelete()` | `firestore.onDocumentDeleted()` | **Available** | |
| **Pub/Sub** | `pubsub.topic().onPublish()` | `pubsub.onMessagePublished()` | **Available** | |
| **Pub/Sub** | `pubsub.schedule().onRun()` | `scheduler.onSchedule()` | **Available** | Moved to `scheduler` namespace. |
| **Storage** | `storage.object().onArchive()` | `storage.onObjectArchived()` | **Available** | |
| **Storage** | `storage.object().onDelete()` | `storage.onObjectDeleted()` | **Available** | |
| **Storage** | `storage.object().onFinalize()` | `storage.onObjectFinalized()` | **Available** | |
| **Storage** | `storage.object().onMetadataUpdate()` | `storage.onObjectMetadataUpdated()` | **Available** | |
| **HTTPS** | `https.onRequest()` | `https.onRequest()` | **Both** | Same name, different module. |
| **HTTPS** | `https.onCall()` | `https.onCall()` | **Both** | Different parameter type (`CallableRequest`). |
| **Tasks** | `tasks.taskQueue().onDispatch()` | `tasks.onTaskDispatched()` | **Available** | |
