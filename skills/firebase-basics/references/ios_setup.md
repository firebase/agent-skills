# Firebase iOS Setup Guide

## 1. Create a Firebase Project and App
If you haven't already created a project:

```bash
firebase projects:create
```

Register your iOS app in the Firebase Console and download the `GoogleService-Info.plist` file. Add this file to the root of your Xcode project, ensuring it's included in your app's target.

## 2. Installation
Add the Firebase SDK to your iOS project using Swift Package Manager.

1. Open your project in Xcode.
2. Go to **File > Add Package Dependencies...**
3. Enter the repository URL `https://github.com/firebase/firebase-ios-sdk`.
4. Choose the version you want to use and add the package to your project.
5. Select the specific Firebase products you need, such as `FirebaseCore`, `FirebaseAuth`, and `FirebaseFirestore`.

## 3. Initialization
Configure the shared `FirebaseApp` instance. You can do this either in a modern SwiftUI `App` structure or a traditional `AppDelegate`.

### SwiftUI (Modern)
```swift
import SwiftUI
import FirebaseCore

@main
struct YourApp: App {
  init() {
    FirebaseApp.configure()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
```

### AppDelegate (Traditional / UIKit)
```swift
import UIKit
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    FirebaseApp.configure()
    return true
  }
}
```
