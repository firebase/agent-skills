# Adding Firebase to your Android App

This guide walks you through adding Firebase to your Android project using Kotlin DSL (`build.gradle.kts`).

### 1. Register your app in the Firebase Console

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your Firebase project.
3. Click the **Android icon** to add a new app.
4. Enter your app's package name (e.g., `com.example.myapp`) and follow the workflow.
5. Download the `google-services.json` file and place it in your app module directory (usually `app/`).

---

### 2. Configure Gradle Files

#### Project-level `build.gradle.kts`
Add the Google Services plugin to your root-level `build.gradle.kts` file:

```kotlin
plugins {
    // ... other plugins
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

#### Module-level (app) `build.gradle.kts`
Apply the plugin and add the Firebase BOM (Bill of Materials) to manage your Firebase library versions:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Add the Google services plugin
    id("com.google.gms.google-services")
}

dependencies {
    // Import the Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:33.0.0")) // Check for latest version

    // Add the dependency for the Firebase SDKs you want to use
    // When using the BoM, don't specify versions in Firebase library dependencies
    implementation("com.google.firebase:firebase-analytics")
    
    // Add other Firebase products as needed (e.g., Auth, Firestore)
    // implementation("com.google.firebase:firebase-auth")
}
```

### Next Steps:
*   **Sync your project:** In Android Studio, click **"Sync Now"** in the notification bar that appears after file changes.
*   **Verify Connection:** Run your app to send verification to the Firebase console that you've successfully installed the SDK.
