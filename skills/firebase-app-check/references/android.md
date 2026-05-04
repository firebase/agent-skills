# Android App Check Setup

Cheatsheet for setting up App Check on Android.

## Provider
- **Play Integrity**: Default and recommended provider.

## Setup Steps

1.  **Google Play Console**:
    - Select your app.
    - In **Release > App integrity**, link your Firebase project.
2.  **Firebase Console**:
    - Navigate to **Security > App Check**.
    - Register your app with **Play Integrity**.
    - Provide the SHA-256 fingerprint of your app's signing certificate.
3.  **Add SDK**:
    - In your `app/build.gradle`, add the dependency:
      ```gradle
      implementation 'com.google.firebase:firebase-appcheck-playintegrity'
      ```
4.  **Initialization**:
    - Initialize App Check in your `Application` class or early in your main activity.

### Kotlin Example

```kotlin
import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        val firebaseAppCheck = FirebaseAppCheck.getInstance()
        firebaseAppCheck.installAppCheckProviderFactory(
            PlayIntegrityAppCheckProviderFactory.getInstance()
        )
    }
}
```

## Gotchas
- Requires Google Play services on the device.
- Daily quota of 10,000 calls for Standard tier.
- Use Debug provider for emulators.
