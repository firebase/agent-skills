# Firebase Crashlytics iOS Setup Guide

## 1. Automated Project and App Setup

Use the `firebase-tools` CLI to set up the project if necessary.

1.  **Find Bundle ID:** Read the Xcode project to find the iOS bundle ID. Check the `PRODUCT_BUNDLE_IDENTIFIER` value in the `.pbxproj` file or the `Info.plist` file.
2.  **Create Firebase Project:** If no project exists, create one:
    `npx -y firebase-tools@latest projects:create <project-id> --display-name="My Awesome App"`
3.  **Create Firebase App:** Register the iOS app with the discovered bundle ID:
    `npx -y firebase-tools@latest apps:create IOS <bundle-id>`
4.  **Download Config File:** Fetch the `GoogleService-Info.plist` file:
    `npx -y firebase-tools@latest apps:sdkconfig IOS <app-id>`
5.  **Save and Link Config File:** Save the output as `GoogleService-Info.plist` at the root of the Xcode project directory. The agent must ensure this file is linked to the main application target in Xcode.

## 2. Add Swift Package Dependencies

Install the SDK using the Swift packages manager.

The following packages are required from the `https://github.com/firebase/firebase-ios-sdk.git` repository:
- `FirebaseCrashlytics`
- `FirebaseAnalytics`

## 3. Initialize Firebase in App Code

Modify the application's entry point to initialize Firebase.

### For SwiftUI Apps (`App.swift`)

Ensure `FirebaseApp.configure()` is called. The safest pattern is to use an `AppDelegate`.

1.  **Ensure `AppDelegate` is used:**

    *File: `YourApp.swift`*
    ```swift
    import SwiftUI
    import FirebaseCore

    @main
    struct YourApp: App {
      @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

      var body: some Scene {
        WindowGroup {
          ContentView()
        }
      }
    }
    ```

2.  **Configure Firebase in `AppDelegate.swift`:**

    *File: `AppDelegate.swift`*
    ```swift
    import UIKit
    import FirebaseCore

    class AppDelegate: NSObject, UIApplicationDelegate {
      func application(_ application: UIApplication,
                       didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        FirebaseApp.configure()
        return true
      }
    }
    ```

### For UIKit Apps (`AppDelegate.swift`)

*File: `AppDelegate.swift`*
```swift
import UIKit
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    FirebaseApp.configure()
    return true
  }
}
```

## 4. Add dSYM Upload Script

Add a Run Script phase to the main app target in Xcode. This step is required to upload dSYM files for crash symbolication. 

1.  **Debug Information Format**: The `Debug Information Format` in Build Settings must be set to `DWARF with dSYM File`.
2.  **Run Script Content**: A new "Run Script Phase" should be added to the target's "Build Phases" with the following content:
    ```bash
    ${BUILD_DIR%/Build/*}/SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run
    ```

## 5. Force a Test Crash

**Action:** Add code to trigger a crash a few seconds after app startup to verify Crashlytics setup.

1.  **For SwiftUI Apps (in `AppDelegate.swift`):**

    *File: `AppDelegate.swift`*
    ```swift
    import FirebaseCore
    import Dispatch // For DispatchQueue

    // ...

    class AppDelegate: NSObject, UIApplicationDelegate {
      func application(_ application: UIApplication,
                       didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        FirebaseApp.configure()
        // Force a crash after a delay to test Crashlytics
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            fatalError("Test Crash")
        }
        return true
      }
    }
    ```

After adding the code, build and run your app. It should crash after approximately 3 seconds. Restart the app. The Crashlytics SDK will send the crash report to Firebase on the next app launch. The report will appear in the Firebase console after a few minutes.
