# Firebase Remote Config - Android Setup Guide (Kotlin)

This guide describes the SDK setup and basic usage patterns for
Firebase Remote Config in an Android app using
Kotlin DSL (`build.gradle.kts`) and Kotlin code.

## Prerequisites

IMPORTANT: Before specifically working with Firebase Remote Config, make sure
to use the skill and reference `firebase_basics/references/android_setup` to
ensure the following is done.

- The Firebase CLI is available and authenticated.
- An Android project exists and is registered with a Firebase Project.
- The Android project has a Firebase config file (`google-services.json`) and
  the Google services Gradle plugin (`google-services`).

## 1. Add dependencies to Gradle build files

> [!IMPORTANT] **[AGENT] RESOLVING THE SDK VERSION DETERMINISTICALLY**
> Never guess or hardcode a memorized out-of-date SDK or plugin version.
> Before adding dependencies, you MUST query the latest available versions
> directly from the Google Maven Repository:
>
> ```bash
> # Find the latest Firebase Android BoM version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest firebase-config version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-config/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```
>
> If the dependency is already declared, fetch the exact resolved version
> currently active in the workspace's build graph:
>
> ```bash
> ./gradlew -q :app:dependencyInsight --dependency firebase-config --configuration releaseRuntimeClasspath
> ```

These changes are made to the Android project's Gradle files.

Google Analytics for Firebase is highly recommended as it enables conditional
targeting based on user properties and audiences. Additional manual setup for
Google Analytics is required (see "Before you begin" in
https://firebase.google.com/docs/analytics/android/get-started.md.txt)

In the **module (app-level)** `build.gradle.kts` (usually
`<project>/<app-module>/build.gradle.kts`), add the dependencies for
Firebase Remote Config and Google Analytics:

```kotlin
dependencies {
    // [AGENT] Fetch the latest resolved version using the Gradle command above
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

    // Add the dependencies for the Firebase Remote Config and Analytics libraries
    // When using the BoM, don't specify versions in Firebase library dependencies
    implementation("com.google.firebase:firebase-config")
    implementation("com.google.firebase:firebase-analytics")
}
```

______________________________________________________________________

## 2. Set in-app defaults

1.  Define default values so the app has functional logic before it ever fetches
    a template from the server. Create an XML file (e.g.,
    `res/xml/remote_config_defaults.xml`):

    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <!-- Example Remote Config Defaults File -->
    <defaultsMap>
        <entry>
            <key>welcome_message</key>
            <value>Welcome to the app!</value>
        </entry>
        <entry>
            <key>is_feature_enabled</key>
            <value>false</value>
        </entry>
    </defaultsMap>
    ```

2.  Initialize the SDK in the Activity or Application class:

    ```kotlin
    val remoteConfig = Firebase.remoteConfig
    remoteConfig.setDefaultsAsync(R.xml.remote_config_defaults)
    ```

______________________________________________________________________

## 3. Fetch and activate values

To apply values from the cloud, fetch them and then activate them in the app:

```kotlin
remoteConfig.fetchAndActivate()
    .addOnCompleteListener(this) { task ->
        if (task.isSuccessful) {
            val updated = task.result
            println("Config params updated: $updated")
        } else {
            println("Fetch failed")
        }
        // Access a value
        val message = remoteConfig.getString("welcome_message")
    }
```
