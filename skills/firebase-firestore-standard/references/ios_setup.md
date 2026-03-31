# Firebase Firestore iOS Setup Guide

# ⛔️ CRITICAL RULE: NO FirebaseFirestoreSwift ⛔️

UNDER NO CIRCUMSTANCES should you import, link against, or configure a project to use `FirebaseFirestoreSwift`. 

As of Firebase SDK v11+, all Swift-specific features (including `@DocumentID`, `@ServerTimestamp`, and `Codable` support) have been fully merged into the main `FirebaseFirestore` module.

- NEVER add `.external(name: "FirebaseFirestoreSwift")` or similar to SPM or Xcode configurations.
- NEVER write `import FirebaseFirestoreSwift` in any Swift file. 
- ONLY use `import FirebaseFirestore`.

This is a zero-tolerance constraint. Using `FirebaseFirestoreSwift` is fundamentally incorrect and unacceptable.

# ⛔️ CRITICAL RULE: PROACTIVE INDEXING ⛔️
Whenever you write a query that combines an equality filter (`whereField("x", isEqualTo: y)`) with an order-by clause (`order(by: "z")`) or a range filter, you **MUST** proactively generate the required composite index in `firestore.indexes.json` and deploy it. Do NOT wait for the code to run and crash.
- Read `indexes.md` for the exact JSON template and deployment command.

# ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️
NEVER write `let db = Firestore.firestore()` as an inline class or struct property if there is ANY chance the object is instantiated before `FirebaseApp.configure()` executes in the app root.
- **FATAL CRASH:** `@Observable class DataManager { let db = Firestore.firestore() }` initialized as a `@State` in the App root.
- **SAFE PATTERN:** Initialize `Firestore.firestore()` lazily (`lazy var db = Firestore.firestore()`) OR explicitly initialize the manager *after* `FirebaseApp.configure()` finishes.

## 1. Import and Initialize
Ensure you have installed the `FirebaseFirestore` SDK. Use the `xcode-project-setup` skill to automate adding the SPM dependency to the Xcode project.

```swift
import FirebaseFirestore
```

Initialize an instance of Cloud Firestore:
```swift
let db = Firestore.firestore()
```

## 2. Type-Safe Data Models (Codable)
To leverage modern Swift data modeling, define your data as `Codable` structs. The main `FirebaseFirestore` module automatically supports mapping these types.

```swift
struct User: Codable {
    @DocumentID var id: String?
    var firstName: String
    var lastName: String
    var born: Int
}
```

## 3. Writing Data (Modern Concurrency & Codable)
Using `async/await` and `Codable` ensures type safety and avoids callback hell.

```swift
let user = User(firstName: "Ada", lastName: "Lovelace", born: 1815)

do {
    // Add a new document with a generated ID using Codable
    let ref = try db.collection("users").addDocument(from: user)
    print("Document added with ID: \(ref.documentID)")
} catch {
    print("Error adding document: \(error)")
}
```

## 4. Reading Data (Modern Concurrency & Codable)
```swift
do {
    let querySnapshot = try await db.collection("users").getDocuments()
    
    // Map documents to the User struct automatically
    let users = querySnapshot.documents.compactMap { document in
        try? document.data(as: User.self)
    }
    
    for user in users {
        print("Found user: \(user.firstName) \(user.lastName)")
    }
} catch {
    print("Error getting documents: \(error)")
}
```

## 5. Legacy Options (Dictionaries & Completion Handlers)

While type-safe models (`Codable`) and modern concurrency (`async/await`) are strongly recommended, writing or reading raw dictionaries (`[String: Any]`) and using completion handlers is completely legal. Use these legacy options if `Codable` does not meet the requirements of a specific architectural pattern or when working within an older codebase.

**Example (Legacy Dictionary Write):**
```swift
var ref: DocumentReference? = nil
ref = db.collection("users").addDocument(data: [
    "first": "Ada",
    "last": "Lovelace",
    "born": 1815
]) { err in
    if let err = err {
        print("Error adding document: \(err)")
    } else {
        guard let ref = ref else { return }
        print("Document added with ID: \(ref.documentID)")
    }
}
```

## 6. Realtime Listeners in SwiftUI (Lifecycle Best Practices)

When implementing Firestore realtime listeners (`addSnapshotListener`) within a SwiftUI application, you **MUST** tie the listener lifecycle to the view's identity using `.task(id:)`, NOT `.onDisappear`.

### ⛔️ UNSAFE PATTERN (.onDisappear)
Presenting a `.sheet` or `.fullScreenCover` can trigger the underlying view's `onDisappear` method. If you stop your listener here, the feed will stop updating while the sheet is open, and won't resume when it's dismissed.
```swift
// WRONG
.task {
    manager.startListening()
}
.onDisappear {
    manager.stopListening() // Will prematurely kill listener when sheets present!
}
```

### ✅ SAFE PATTERN (.task with id)
Using `.task(id:)` inherently manages cancellation. The task is automatically cancelled and restarted *only* if the underlying `id` changes (e.g., the User ID changes). The listener survives when sheets are presented on top of the view.
```swift
// CORRECT
.task(id: authManager.userId) {
    if let userId = authManager.userId {
        manager.startListening(for: userId)
    } else {
        manager.stopListening()
    }
}
```
*Note: Make sure to safely remove the `ListenerRegistration` within the `deinit` or cleanup methods of your manager class.*