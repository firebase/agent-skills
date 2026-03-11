# Firebase Firestore iOS Setup Guide

## 1. Import and Initialize
Ensure you have installed the `FirebaseFirestore` SDK via Swift Package Manager.

```swift
import FirebaseFirestore
```

Initialize an instance of Cloud Firestore:
```swift
let db = Firestore.firestore()
```

## 2. Writing Data
```swift
// Add a new document with a generated ID
var ref: DocumentReference? = nil
ref = Firestore.firestore().collection("users").addDocument(data: [
    "first": "Ada",
    "last": "Lovelace",
    "born": 1815
]) { err in
    if let err = err {
        print("Error adding document: \(err)")
    } else {
        guard let validRef = ref else { return }
        print("Document added with ID: \(validRef.documentID)")
    }
}
```

## 3. Reading Data
```swift
Firestore.firestore().collection("users").getDocuments() { (querySnapshot, err) in
    if let err = err {
        print("Error getting documents: \(err)")
    } else {
        guard let snapshot = querySnapshot else { return }
        for document in snapshot.documents {
            print("\(document.documentID) => \(document.data())")
        }
    }
}
```
