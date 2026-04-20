# iOS App Check Setup

Cheatsheet for setting up App Check on iOS.

## Providers
- **App Attest**: Recommended for iOS 14+. Stronger security.
- **DeviceCheck**: Fallback or for iOS 11+.

## Setup Steps

1.  **Firebase Console**:
    - Navigate to **Security > App Check**.
    - Register your app with **DeviceCheck** or **App Attest**.
    - For DeviceCheck, you need to upload a private key (`.p8` file) from Apple Developer account.
    - For App Attest, you need to link your team ID.

2.  **Add SDK**:
    - Swift Package Manager: Add `firebase-app-check`.
    - CocoaPods: `pod 'FirebaseAppCheck'`

3.  **Initialization**:
    - Initialize the App Check provider factory *before* calling `FirebaseApp.configure()`.

### Swift Example (App Attest)

```swift
import UIKit
import FirebaseCore
import FirebaseAppCheck

class AppDelegate: NSObject, UIApplicationDelegate {
  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    // Use AppAttestProviderFactory
    let providerFactory = AppCheckDebugProviderFactory() // Use debug for simulator
    // In production, use AppAttestProviderFactory
    // let providerFactory = AppAttestProviderFactory()
    AppCheck.setAppCheckProviderFactory(providerFactory)

    FirebaseApp.configure()

    return true
  }
}
```

### Swift Example (DeviceCheck)

```swift
import UIKit
import FirebaseCore
import FirebaseAppCheck

class AppDelegate: NSObject, UIApplicationDelegate {
  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    let providerFactory = DeviceCheckProviderFactory()
    AppCheck.setAppCheckProviderFactory(providerFactory)

    FirebaseApp.configure()

    return true
  }
}
```

## Gotchas
- App Attest requires the `com.apple.developer.devicecheck.appattest` entitlement.
- Debug provider is needed for simulators. See `SKILL.md` for debug token instructions.
