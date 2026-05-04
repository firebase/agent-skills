# Flutter App Check Setup

Cheatsheet for setting up App Check in Flutter apps.

## Platform Providers
Flutter App Check uses the default provider for each platform:
- **Android**: Play Integrity
- **iOS**: Device Check or App Attest
- **Web**: reCAPTCHA v3 or Enterprise

## Setup Steps

1.  **Firebase Console**: Register your iOS, Android, and Web apps in the Firebase console under **Security > App Check** as described in the platform-specific reference files.
2.  **Add Dependency**:
    ```bash
    flutter pub add firebase_app_check
    ```
3.  **Initialization**: Initialize App Check in your `main()` function after `Firebase.initializeApp()`.

### Flutter Example

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  await FirebaseAppCheck.instance.activate(
    // Web Provider
    webProvider: ReCaptchaV3Provider('your-recaptcha-v3-site-key'),
    
    // Android Provider (Default is Play Integrity)
    androidProvider: AndroidProvider.playIntegrity,
    
    // Apple Provider (Default is Device Check)
    appleProvider: AppleProvider.appAttest,
  );

  runApp(const MyApp());
}
```

## Gotchas
- Ensure you follow the setup steps for each platform (e.g., linking Play project, uploading `.p8` for iOS) in the Firebase console.
- See platform-specific reference files for platform-specific gotchas.
