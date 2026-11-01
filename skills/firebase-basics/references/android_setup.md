# Firebase Android Setup Guide

______________________________________________________________________

## Prerequisites

1. **Firebase CLI**: Make sure the Firebase CLI is available and authenticated.

   For detailed instructions about the Firebase CLI, see
   `firebase_basics/references/local-env-setup`. Here are high-level
   instructions for setting up the Firebase CLI.

   1. Ensure the Firebase CLI is available:

      ```bash
      npx -y firebase-tools@latest --version
      ```

   1. Login to the CLI:

      - local:

        ```bash
        npx -y firebase-tools@latest login
        ```

      - remote servers:

        ```bash
        npx -y firebase-tools@latest login --no-localhost
        ```

1. **Android project**: Create or use an existing Android project in an
   Android-development IDE.

______________________________________________________________________

## 1. Check if the Android project is connected to a Firebase Project

Check if the Android project already has a `google-services.json` file in its
**module (app-level)** root directory.

### `google-services.json` file is present

If the Android project already has a `google-services.json` file, do NOT create
a new Firebase project or re-register the app — skip steps 2 through 4 below.
Instead, verify the existing Firebase setup within the codebase and fix anything
that is missing:

- The `google-services.json` file is in the **module (app-level)** root
  directory: `app/google-services.json`

- The Google services Gradle plugin (`google-services`) is added to *both* the
  project-level and module (app-level) Gradle build files. If it is missing from
  either file, add it by following step 5 below.

### `google-services.json` file is NOT present

If the Android project does NOT already have a `google-services.json` file, then
proceed with the remaining steps in this guide.

______________________________________________________________________

## 2. Create a new Firebase project or use an existing one

Check if there's an existing Firebase Project available for use with the Android
project:

```bash
npx -y firebase-tools@latest projects:list
```

- **If existing Firebase Project:** Ask the human user if they want to use the
  existing project.

- **If no existing Firebase Project or human user does not want to use an
  existing project:** Create a new Firebase Project.

  Provide a required unique PROJECT_ID and an optional PROJECT_DISPLAY_NAME:

  ```bash
  npx -y firebase-tools@latest projects:create <UNIQUE_PROJECT_ID> --display-name <PROJECT_DISPLAY_NAME>
  ```

  *Example:*

  ```bash
  npx -y firebase-tools@latest projects:create my-cool-app-20260330 --display-name MyCoolApp
  ```

______________________________________________________________________

## 3. Register the Android project

Register the app module (package name) of the Android project with the Firebase
project. Provide an optional APP_DISPLAY_NAME and required PACKAGE_NAME:

```bash
npx -y firebase-tools@latest apps:create ANDROID <APP_DISPLAY_NAME> --package-name <PACKAGE_NAME> --project <PROJECT_ID>
```

*Example:*

```bash
npx -y firebase-tools@latest apps:create ANDROID MyApplication --package-name com.example.myapplication --project my-cool-app-20260330
```

NOTE: A package name is often referred to as an *application ID* within an
Android project. Find an app's package name in the module (app-level) Gradle
file, usually `app/build.gradle.kts`.

______________________________________________________________________

## 4. Obtain and save `google-services.json`

1. Fetch the Firebase configuration file (`google-services.json`) using the
   Firebase Android APP_ID (which is printed in the output of the previous
   `apps:create` command):

   ```bash
   npx -y firebase-tools@latest apps:sdkconfig ANDROID <APP_ID> --project <PROJECT_ID>
   ```

1. Save the configuration file within the **module (app-level)** root directory
   of the Android project: `app/google-services.json`

______________________________________________________________________

## 5. Add the `google-services` plugin

> [!IMPORTANT] **[AGENT] RESOLVING THE PLUGIN VERSION DETERMINISTICALLY** Never
> guess or hardcode a memorized out-of-date plugin version. Before adding
> dependencies, you MUST query the latest available versions directly from the
> Google Maven Repository:
>
> ```bash
> # Find the latest Google services Gradle plugin version
> curl -s https://dl.google.com/dl/android/maven2/com/google/gms/google-services/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```

These changes are made to the Android project's Gradle files.

### Project-level `build.gradle.kts` (`<project>/build.gradle.kts`)

Add the latest version of the Google services Gradle plugin to the `plugins`
block:

```kotlin
plugins {
    // ... other plugins

    // [AGENT] Fetch the latest resolved version using the Gradle command above
    id("com.google.gms.google-services") version "<latest_plugin_version>" apply false
}
```

### Module (app-level) `build.gradle.kts` (`<project>/<app-module>/build.gradle.kts`)

Add the Google services Gradle plugin to the `plugins` block:

```kotlin
plugins {
    // ... other plugins
    id("com.google.gms.google-services")
}
```

______________________________________________________________________

## 6. App Check (Debug Tokens)

`DebugAppCheckProviderFactory.getInstance()` generates a random UUID debug
secret the first time it runs, stores it in `SharedPreferences`, and prints it
to Logcat (`DebugAppCheckProvider: Firebase App Check debug token: ...`). The
secret survives app updates, but uninstalling the app, clearing its storage or
wiping the emulator produces a new one.

There is no build setting that pins this secret for normal debug runs. The
provider only reads a fixed secret from instrumentation arguments, so **manifest
placeholders and `BuildConfig` fields have no effect on it.** For normal debug
runs, register each device's or emulator's token in the Firebase Console under
**Security > App Check > Apps > Manage debug tokens**, and register the new one
after a fresh install.

> [!WARNING] **CRITICAL: Never Hardcode or Commit Debug Tokens** App Check debug
> tokens allow clients to bypass attestation and access backend resources
> without a genuine device. **Never hardcode debug token strings in
> build.gradle.kts, Java, or Kotlin files, and never commit tokens to version
> control.** If a token is compromised, revoke it immediately in the Firebase
> Console.

Install the debug provider for debug builds in your application or activity:

```kotlin
if (BuildConfig.DEBUG) {
    Firebase.appCheck.installAppCheckProviderFactory(
        DebugAppCheckProviderFactory.getInstance()
    )
}
```

### Fixed debug token for instrumentation tests (CI)

Instrumentation tests can use one stable, registered token through
`firebase-appcheck-debug-testing`, which reads the secret from the
`firebaseAppCheckDebugSecret` instrumentation argument.

1. Register a UUID as a debug token in the Firebase Console, then store it in
   your project's gitignored `local.properties` (or a CI secret exposed as the
   `APP_CHECK_DEBUG_TOKEN` environment variable):

   ```properties
   # In local.properties (ensure this file is in your .gitignore!)
   APP_CHECK_DEBUG_TOKEN=<YOUR_DEBUG_TOKEN>
   ```

1. Pass it to the test runner and add the testing artifact in
   `app/build.gradle.kts`:

   ```kotlin
   val localProperties = java.util.Properties().apply {
       val localPropertiesFile = rootProject.file("local.properties")
       if (localPropertiesFile.exists()) {
           load(localPropertiesFile.inputStream())
       }
   }
   val appCheckDebugToken = localProperties.getProperty("APP_CHECK_DEBUG_TOKEN")
       ?: System.getenv("APP_CHECK_DEBUG_TOKEN") ?: ""

   android {
       defaultConfig {
           if (appCheckDebugToken.isNotEmpty()) {
               testInstrumentationRunnerArguments["firebaseAppCheckDebugSecret"] = appCheckDebugToken
           }
       }
   }

   dependencies {
       androidTestImplementation("com.google.firebase:firebase-appcheck-debug-testing")
   }
   ```

1. Run the test code inside `DebugAppCheckTestHelper`, which installs the debug
   provider with that secret and restores the previous provider afterwards:

   ```kotlin
   @Test
   fun readsProtectedData() {
       DebugAppCheckTestHelper.fromInstrumentationArgs().withDebugProvider<Exception> {
           // Calls to App Check-protected Firebase services
       }
   }
   ```

______________________________________________________________________

## Verification plan

### Manual verification

Validate that the Firebase Project was created and the Firebase Android App was
registered successfully:

```bash
npx -y firebase-tools@latest projects:list
npx -y firebase-tools@latest apps:list --project <PROJECT_ID>
```

______________________________________________________________________
