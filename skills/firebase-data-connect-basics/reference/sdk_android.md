# Firebase SQL Connect - Android Setup Guide (Kotlin)

This guide describes the SDK setup and basic usage patterns for
Firebase SQL Connect in an Android app using
Kotlin DSL (`build.gradle.kts`) and Kotlin code.

## Prerequisites

IMPORTANT: Before specifically working with Firebase SQL Connect, make sure
to use the skill and reference `firebase_basics/references/android_setup` to
ensure the following is done.

- The Firebase CLI is available and authenticated.
- An Android project exists and is registered with a Firebase Project.
- The Android project has a Firebase config file (`google-services.json`) and
  the Google services Gradle plugin (`google-services`).

## Best practices for agents working with Firebase SQL Connect

- **Understand Operation Storage**: SQL Connect queries and mutations are stored
  on the server like Cloud Functions. **Whenever you update operations, you must
  regenerate the SDK and redeploy services** that use it to avoid breaking
  clients.
- **Resilient Enum Handling**: The generated SDK forces handling of unknown
  values by wrapping them in `EnumValue`. You must unwrap it into
  `EnumValue.Known` or `EnumValue.Unknown` to handle schema updates gracefully.
- **Flow Behavior**: While you can collect a Flow from a query, note that **this
  Flow is not updated in real-time automatically** by default. It only produces
  a result when a new query result is retrieved using a call to the query's
  `execute()` method.
- **Leverage Coroutines**: Call `.execute()` within a coroutine scope for
  asynchronous operations.

______________________________________________________________________

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
> # Find the latest firebase-dataconnect version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-dataconnect/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```
>
> If the dependency is already declared, fetch the exact resolved version
> currently active in the workspace's build graph:
>
> ```bash
> ./gradlew -q :app:dependencyInsight --dependency firebase-dataconnect --configuration releaseRuntimeClasspath
> ```

In the **module (app-level)** `build.gradle.kts` (usually
`<project>/<app-module>/build.gradle.kts`), add the
Kotlin serialization plugin and the dependency for Firebase SQL Connect:

1.  Add the Kotlin serialization plugin to the `plugins` block:

    ```kotlin
    plugins {
        // ... other plugins
        kotlin("plugin.serialization") version "1.8.22" // Must match Kotlin version
    }
    ```

2.  Add the required Firebase SQL Connect dependencies to the `dependencies`
    block:

    ```kotlin
    dependencies {
        // ... other dependencies

        // [AGENT] Fetch the latest resolved version using the Gradle command above
        implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

        // Add the dependency for the Firebase SQL Connect library
        // When using the BoM, don't specify versions in Firebase library dependencies
        implementation("com.google.firebase:firebase-dataconnect")

        // Add additional required dependencies
        implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
        implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.5.1")
    }
    ```

______________________________________________________________________

## 2. Initialize

Retrieve the generated connector instance:

```kotlin
import com.google.firebase.dataconnect.generated.MoviesConnector

val connector = MoviesConnector.instance

// For local development with emulator
// Defaults to correct host for Android emulator (10.0.2.2)
connector.dataConnect.useEmulator()
// Or specify a non-default port:
// connector.dataConnect.useEmulator(port = 9999)
```

______________________________________________________________________

## 3. Work with SQL Connect

### Calling operations

#### Basic query

```kotlin
val result = connector.listMovies.execute()
result.data.movies.forEach { movie ->
    println(movie.title)
}
```

#### Mutation

```kotlin
val newMovie = connector.createMovie.execute(
    title = "Empire Strikes Back",
    releaseYear = 1980,
    genre = "Sci-Fi",
    rating = 5
)
```

### Resilient enum handling

Unwrap the `EnumValue` to handle known and unknown cases safely.

```kotlin
val result = connector.listMovies.execute()

result.data.movies.forEach { movie ->
    when (val aspect = movie.aspectratio) {
        is EnumValue.Known -> println("Known aspect: ${aspect.value.name}")
        is EnumValue.Unknown -> println("Unknown aspect: ${aspect.stringValue}")
    }
}
```

### Client-side caching

Enable caching in `connector.yaml` to reduce requests and support offline
scenarios.

```yaml
generate:
  kotlinSdk:
    outputDir: "../android"
    package: "com.google.firebase.dataconnect.generated"
    clientCache:
      maxAge: 5s
      storage: persistent # Default for Android is persistent
```

Use policies in code:

```kotlin
val queryResult = queryRef.execute(QueryRef.FetchPolicy.CACHE_ONLY)
val queryResult = queryRef.execute(QueryRef.FetchPolicy.SERVER_ONLY)
```

### Data type mapping reference

- GraphQL `String` -> Kotlin `String`
- GraphQL `Int` -> Kotlin `Int` (32-bit)
- GraphQL `Float` -> Kotlin `Double` (64-bit)
- GraphQL `Boolean` -> Kotlin `Boolean`
- GraphQL `UUID` -> Kotlin `java.util.UUID`
- GraphQL `Date` -> Kotlin `com.google.firebase.dataconnect.LocalDate`
- GraphQL `Timestamp` -> Kotlin `com.google.firebase.Timestamp`
- GraphQL `Int64` -> Kotlin `Long`
- GraphQL `Any` -> Kotlin `com.google.firebase.dataconnect.AnyValue`
