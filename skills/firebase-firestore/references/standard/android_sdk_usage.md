# Cloud Firestore (Standard edition) - Android Setup Guide (Kotlin)

This guide describes the SDK setup and basic usage patterns for
Cloud Firestore (Standard edition) in an Android app using
Kotlin DSL (`build.gradle.kts`) and Kotlin code.

## Prerequisites

IMPORTANT: Before specifically working with Cloud Firestore, make sure
to use the skill and reference `firebase_basics/references/android_setup` to
ensure the following is done.

- The Firebase CLI is available and authenticated.
- An Android project exists and is registered with a Firebase Project.
- The Android project has a Firebase config file (`google-services.json`) and
  the Google services Gradle plugin (`google-services`).

______________________________________________________________________

## 1. Provision Firestore

Follow the instructions in
`firebase_firestore/references/standard/provisioning` to do the following:

- Provision a Firestore instance (Standard edition)
- Create or append a `firebase.json` file
- Create a `firestore.rules` file
- Create a `firestore.indexes.json` file
- Deploy database, rules, and indexes
- Run Firestore locally for development and testing

______________________________________________________________________

## 2. Add dependencies to Gradle build files

> [!IMPORTANT] **[AGENT] RESOLVING THE SDK VERSION DETERMINISTICALLY**
> Never guess or hardcode a memorized out-of-date SDK or plugin version.
> Before adding dependencies, you MUST query the latest available versions
> directly from the Google Maven Repository:
>
> ```bash
> # Find the latest Firebase Android BoM version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest firebase-firestore version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-firestore/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```
>
> If the dependency is already declared, fetch the exact resolved version
> currently active in the workspace's build graph:
>
> ```bash
> ./gradlew -q :app:dependencyInsight --dependency firebase-firestore --configuration releaseRuntimeClasspath
> ```

In the **module (app-level)** `build.gradle.kts` (usually
`<project>/<app-module>/build.gradle.kts`), add the dependency for
Cloud Firestore:

```kotlin
dependencies {
    // [AGENT] Fetch the latest resolved version using the Gradle command above
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

    // Add the dependency for the Cloud Firestore library
    // When using the BoM, don't specify versions in Firebase library dependencies
    implementation("com.google.firebase:firebase-firestore")
}
```

______________________________________________________________________

## 3. Initialize Firestore

In the Activity or Fragment, initialize the `FirebaseFirestore` instance:

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.firestore

class MainActivity : AppCompatActivity() {

    private lateinit var db: FirebaseFirestore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        db = Firebase.firestore

        setContent {
            MaterialTheme {
                Text("Firestore initialized!")
            }
        }
    }
}
```

### Jetpack Compose (Modern)

Initialize inside a `ComponentActivity` using `setContent`:

```kotlin
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.google.firebase.Firebase
import com.google.firebase.firestore.firestore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val db = Firebase.firestore

        setContent {
            MaterialTheme {
                Text("Firestore initialized!")
            }
        }
    }
}
```

______________________________________________________________________

## 4. Work with data

After Firestore is initialized, you can work with data in the following ways.

### Add data

Add a new document with a generated ID using `add()`:

```kotlin
// Create a new user with a first and last name
val user = hashMapOf(
    "first" to "Ada",
    "last" to "Lovelace",
    "born" to 1815
)

// Add a new document with a generated ID
db.collection("users")
    .add(user)
    .addOnSuccessListener { documentReference ->
        Log.d(TAG, "DocumentSnapshot added with ID: ${documentReference.id}")
    }
    .addOnFailureListener { e ->
        Log.w(TAG, "Error adding document", e)
    }
```

Or set a document with a specific ID using `set()`:

```kotlin
val city = hashMapOf(
    "name" to "Los Angeles",
    "state" to "CA",
    "country" to "USA"
)

db.collection("cities").document("LA")
    .set(city)
    .addOnSuccessListener { Log.d(TAG, "DocumentSnapshot successfully written!") }
    .addOnFailureListener { e -> Log.w(TAG, "Error writing document", e) }
```

### Read data

Read a single document using `get()`:

```kotlin
val docRef = db.collection("cities").document("SF")
docRef.get()
    .addOnSuccessListener { document ->
        if (document != null && document.exists()) {
            Log.d(TAG, "DocumentSnapshot data: ${document.data}")
        } else {
            Log.d(TAG, "No such document")
        }
    }
    .addOnFailureListener { exception ->
        Log.d(TAG, "get failed with ", exception)
    }
```

Read multiple documents using a query:

```kotlin
db.collection("cities")
    .whereEqualTo("capital", true)
    .get()
    .addOnSuccessListener { documents ->
        for (document in documents) {
            Log.d(TAG, "${document.id} => ${document.data}")
        }
    }
    .addOnFailureListener { exception ->
        Log.w(TAG, "Error getting documents: ", exception)
    }
```

### Update data

Update some fields of a document using `update()` without overwriting the entire
document:

```kotlin
val washingtonRef = db.collection("cities").document("DC")

// Set the "isCapital" field to true
washingtonRef
    .update("capital", true)
    .addOnSuccessListener { Log.d(TAG, "DocumentSnapshot successfully updated!") }
    .addOnFailureListener { e -> Log.w(TAG, "Error updating document", e) }
```

### Delete data

Delete a document using `delete()`:

```kotlin
db.collection("cities").document("DC")
    .delete()
    .addOnSuccessListener { Log.d(TAG, "DocumentSnapshot successfully deleted!") }
    .addOnFailureListener { e -> Log.w(TAG, "Error deleting document", e) }
```
