# Firebase Crashlytics Android Setup Guide

Important references:

- Refer to the `firebase-basics` skills, particularly those for project and app setup, before proceeding.

## Project and App Setup

Before you begin, ensure you have the following. If a `google-services.json` file is present, then use that Firebase project and app. Otherwise you may need to create them.

- **Firebase CLI**: Installed and logged in (see `firebase-basics`).
- **Firebase Project**: Created via `npx -y firebase-tools@latest projects:create` (see `firebase-basics`).
- **Firebase App**: Created via `npx -y firebase-tools@latest apps:create <IOS|ANDROID|WEB> <package-name-or-bundle-id>`

The `google-services.json` file must be present in the Android app's module directory. If missing, get the config using the Firebase CLI: `npx -y firebase-tools@latest apps:sdkconfig ANDROID <App-ID>`.

## Add Dependencies to Gradle Build

These changes are made to your Android project's Gradle files.

### Project-level `build.gradle.kts` (`<project>/build.gradle.kts`)

Add the Crashlytics plugin to the `plugins` block:

```kotlin
plugins {
    // ... other plugins
    id("com.google.firebase.crashlytics") version "2.9.9" apply false
}
```

### App-level `build.gradle.kts` (`<project>/<app-module>/build.gradle.kts`)

1.  Add the Crashlytics plugin to the `plugins` block:

    ```kotlin
    plugins {
        // ... other plugins
        id("com.google.firebase.crashlytics")
    }
    ```

2.  Add the Firebase Crashlytics dependency to the `dependencies` block. It is recommended to use the Firebase Bill of Materials (BoM) to manage SDK versions.

    ```kotlin
    dependencies {
        // ... other dependencies

        // Import the Firebase BoM
        implementation(platform("com.google.firebase:firebase-bom:32.7.0"))

        // Add the dependencies for the Crashlytics and Analytics
        implementation("com.google.firebase:firebase-crashlytics-ktx")
    }
    ```


## Follow up Steps

The following optional steps are recommended, but don't necessarily apply to all projects.

### Optional: Install the NDK SDK to capture native crashes

If your app uses native code (C/C++), or includes a library with native code, you can configure Crashlytics to report native crashes.

App-level `build.gradle.kts` (`<project>/<app-module>/build.gradle.kts`)

1.  Add the `firebase-crashlytics-ndk` dependency:

    ```kotlin
    dependencies {
        // ... other dependencies
        implementation("com.google.firebase:firebase-crashlytics-ndk:18.6.2")
    }
    ```

2.  Enable the `nativeSymbolUpload` flag in your `buildTypes` configuration. This will automatically upload symbol files for your native code, which are required to symbolicate native crash reports.

    ```kotlin
    android {
        // ... other config
        buildTypes {
            getByName("release") {
                // ...
                firebaseCrashlytics {
                    nativeSymbolUploadEnabled = true
                }
            }
        }
    }
    ```

After these changes, Crashlytics will automatically report crashes in your app's native code.

### Optional: Force a Test Crash

To verify that Crashlytics is correctly installed, you can force a test crash.

1.  Add code to your main activity (e.g., in `onCreate`) to trigger a crash a few seconds after app startup:

    ```kotlin
    import android.os.Handler
    import android.os.Looper

    // ... in your Activity's onCreate method or similar startup logic
    Handler(Looper.getMainLooper()).postDelayed({
        throw RuntimeException("Test Crash") // Force a crash after 3 seconds
    }, 3000)
    ```

2.  Run your app on a device or emulator. The app should crash after a short delay.

3.  Restart the app. The Crashlytics SDK will send the crash report to Firebase on the next app launch.

4.  After a few minutes, the crash should be available in Crashlytics.
  -  If the Firebase MCP server is installed, use the `get_report` tool to check that a crash was received.
  -  As a fallback, visit the Crashlytics dashboard in the Firebase console to see the new crash report.

### Optional: Add custom debugging information

Customize reports to help you better understand what's happening in your app and the circumstances around events reported to Crashlytics. See [Customize Crash Reports for Android](https://firebase.google.com/docs/crashlytics/android/customize-crash-reports).

