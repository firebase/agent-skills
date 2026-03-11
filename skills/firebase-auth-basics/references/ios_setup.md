# Firebase Auth iOS Setup Guide

## 1. Import and Initialize
Ensure you have installed the `FirebaseAuth` SDK via Swift Package Manager.

```swift
import FirebaseAuth
```

## 2. Authentication State
To listen for authentication state changes (recommended way to check if a user is signed in):

```swift
var handle: AuthStateDidChangeListenerHandle?

handle = Auth.auth().addStateDidChangeListener { auth, user in
  if let user = user {
    print("User is signed in with uid: \(user.uid)")
  } else {
    print("User is signed out")
  }
}

// To remove the listener when no longer needed:
Auth.auth().removeStateDidChangeListener(handle!)
```

## 3. Email and Password Authentication

### Sign Up
```swift
Auth.auth().createUser(withEmail: "user@example.com", password: "password") { authResult, error in
  if let error = error {
    print("Error creating user: \(error.localizedDescription)")
    return
  }
  print("User created successfully!")
}
```

### Sign In
```swift
Auth.auth().signIn(withEmail: "user@example.com", password: "password") { authResult, error in
  if let error = error {
    print("Error signing in: \(error.localizedDescription)")
    return
  }
  print("User signed in successfully!")
}
```

## 4. Sign Out
```swift
do {
  try Auth.auth().signOut()
  print("Successfully signed out")
} catch let signOutError as NSError {
  print("Error signing out: %@", signOutError)
}
```
