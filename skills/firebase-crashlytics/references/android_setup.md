# Firebase Crashlytics - Android Setup Guide (Kotlin)

This guide describes the SDK setup and basic usage patterns for
Firebase Crashlytics in an Android app using
Kotlin DSL (`build.gradle.kts`) and Kotlin code.

## Prerequisites

IMPORTANT: Before specifically working with Firebase Crashlytics, make sure
to use the skill and reference `firebase_basics/references/android_setup` to
ensure the following is done.

- The Firebase CLI is available and authenticated.
- An Android project exists and is registered with a Firebase Project.
- The Android project has a Firebase config file (`google-services.json`) and
  the Google services Gradle plugin (`google-services`).

______________________________________________________________________

## 1. Add dependencies to Gradle build files

> [!IMPORTANT] **[AGENT] RESOLVING THE SDK & PLUGIN VERSIONS DETERMINISTICALLY**
> Never guess or hardcode a memorized out-of-date SDK or plugin version.
> Before adding dependencies, you MUST query the latest available versions
> directly from the Google Maven Repository:
>
> ```bash
> # Find the latest Firebase Android BoM version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest Crashlytics Gradle plugin version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-crashlytics-gradle/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest firebase-crashlytics version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-crashlytics/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest firebase-crashlytics-ndk version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-crashlytics-ndk/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```
>
> If the dependency is already declared, fetch the exact resolved version
> currently active in the workspace's build graph:
>
> ```bash
> ./gradlew -q :app:dependencyInsight --dependency firebase-crashlytics --configuration releaseRuntimeClasspath
> ```

These changes are made to the Android project's Gradle files.

### Project-level `build.gradle.kts` (`<project>/build.gradle.kts`)

Add the latest version of the Crashlytics Gradle plugin to the `plugins` block:

```kotlin
plugins {
    // ... other plugins

    // [AGENT] Fetch the latest resolved version using the Gradle command above
    id("com.google.firebase.crashlytics") version "<latest_plugin_version>" apply false
}
```

### Module (app-level) `build.gradle.kts` (`<project>/<app-module>/build.gradle.kts`)

1.  Add the Crashlytics Gradle plugin to the `plugins` block:

    ```kotlin
    plugins {
        // ... other plugins

        id("com.google.firebase.crashlytics")
    }
    ```

2.  Add the Firebase Crashlytics dependency to the `dependencies` block:

    ```kotlin
    dependencies {
        // ... other dependencies

        // [AGENT] Fetch the latest resolved version using the Gradle command above
        implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

        // Add the dependency for the Firebase Crashlytics library
        // When using the BoM, don't specify versions in Firebase library dependencies
        implementation("com.google.firebase:firebase-crashlytics")
    }
    ```

______________________________________________________________________

## 2. *Optional:* Install the NDK SDK to capture native crashes

If the Android project uses native code (C/C++), or includes a library with
native code, configure Crashlytics to report native crashes.

App-level `build.gradle.kts` (`<project>/<app-module>/build.gradle.kts`)

1.  Add the `firebase-crashlytics-ndk` dependency:

    ```kotlin
    dependencies {
        // ... other dependencies

        // [AGENT] Fetch the latest resolved version using the Gradle command above
        implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

        // Add the dependency for the Firebase Crashlytics NDK library
        // When using the BoM, don't specify versions in Firebase library dependencies
        implementation("com.google.firebase:firebase-crashlytics-ndk")
    }
    ```

2.  Enable the `nativeSymbolUpload` flag in the `buildTypes` configuration.
    This will automatically upload symbol files for the native code, which are
    required to symbolicate native crash reports.

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

After these changes, Crashlytics will automatically report crashes in the app's
native code.

______________________________________________________________________

## 3. *Required:* Force a test crash

To verify that Crashlytics is correctly set up in the Android project, force a
test crash in the app.

1.  Add code to the main activity (e.g., in `onCreate`) to trigger a crash a
    few seconds after app startup:

    ```kotlin
    import android.os.Handler
    import android.os.Looper

    // ... in the Activity's onCreate method or similar startup logic
    Handler(Looper.getMainLooper()).postDelayed({
        throw RuntimeException("Test Crash") // Force a crash after 3 seconds
    }, 3000)
    ```

2.  Run the app on a device or emulator. The app should crash after a short
    delay.

3.  Restart the app. The Crashlytics SDK will send the crash report to Firebase
    on the next app launch.

4.  After a few minutes, the crash should be available in Firebase.

    - If the Firebase MCP server is installed, use the `get_report` tool to
      verify that a crash was received.
    - As a fallback, tell the human user to go to the Crashlytics dashboard in
      the Firebase console to verify the new crash report. Provide the human
      user with a constructed Firebase console URL using the Firebase PROJECT_ID
      and the PACKAGE_NAME:
      `https://console.firebase.google.com/u/0/project/PROJECT_ID/crashlytics/app/android:PACKAGE_NAME/issues`

5.  After verifying that Firebase has received the crash report -- either using
    the `get_report` tool or manually viewing it in the Firebase console --
    remove the code that triggers the test crash.

______________________________________________________________________

## Optional additional steps

### Add custom debugging information

Customize reports to help better understand what's happening in the app and the
circumstances around events reported to Crashlytics. See
https://firebase.google.com/docs/crashlytics/android/customize-crash-reports.md.txt.
