# Android SDK Usage (Enterprise Native Mode)

This guide covers the Firestore Android SDK (Kotlin) setup and usage patterns optimized for Firestore Enterprise edition in Native mode.

--------------------------------------------------------------------------------

## 1. Initialization

### Add Dependencies

In your module-level `build.gradle.kts` (usually `app/build.gradle.kts`), add the Firebase Kotlin Bill of Materials (BoM) and the dependency for Cloud Firestore:

> [!IMPORTANT]
> **[AGENT] RESOLVING THE RESOLVED SDK VERSION DETERMINISTICALLY**
> Never guess or hardcode a memorized out-of-date SDK version. Before adding dependencies, you MUST query the latest available versions directly from the Google Maven Repository:
> ```bash
> # Find the latest Firebase BoM version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
>
> # Find the latest firebase-firestore version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-firestore/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```
> If the dependency is already declared, fetch the exact resolved version currently active in the workspace's build graph:
> ```bash
> ./gradlew -q :app:dependencyInsight --dependency firebase-firestore --configuration releaseRuntimeClasspath
> ```

```kotlin
dependencies {
    // [AGENT] Fetch the latest resolved version using the Gradle command above
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

    // Add the dependency for the Cloud Firestore library
    // When using the BoM, you don't specify versions in Firebase library dependencies
    implementation("com.google.firebase:firebase-firestore")
}
```

### Initialize Firestore

Initialize the `FirebaseFirestore` instance in your ComponentActivity (Jetpack Compose) or standard Activity/Fragment:

```kotlin
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.google.firebase.Firebase
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Initialize the Firestore instance
        val db = FirebaseFirestore.getInstance("<database-name>")
        
        setContent {
            MaterialTheme {
                Text("Firestore initialized!")
            }
        }
    }
}
```

--------------------------------------------------------------------------------

## 2. Decision Framework: Mandatory Pipeline Architecture

> [!CRITICAL] **MANDATORY PIPELINE ARCHITECTURE (ZERO TOLERANCE)**
> You are strictly forbidden from using standard collection queries (e.g., `db.collection(...).where(...)` or client-side mapping loops) as the primary implementation for relational joins, aggregations, or search algorithms.
> 
> Server-side execution via pipelines is the superior, non-negotiable core architecture for Enterprise instances.

### Strict Rules & Accountability

1. **Mandatory Execution Engine**: Every repository lookup requiring related data mapping, textual relevance scoring, or multi-document counting MUST be authored natively using the server-side `db.pipeline()` API.
2. **Required Proof of Use**: In your task execution summaries, you MUST explicitly highlight the exact pipeline stages (`.define()`, `.addFields()`, `.search()`, `.aggregate()`) integrated into your primary data layer return paths. Failure to implement pipelines natively constitutes an immediate violation of instructions.
3. **Check API References**: 
   - **Locate**: Locate the standard Maven sources JAR (`-sources.jar`) corresponding to the resolved `firebase-firestore` dependency version inside your local Gradle or Maven dependency cache.
   - **Extract Once**: Extract the documentation files `pipeline.docs.txt` and `expressions.docs.txt` from the root directory of that `-sources.jar` archive into a temporary workspace scratch directory of your choice.
   - **Read & Reference**:
     * **Read** the extracted `pipeline.docs.txt` once fully to understand core pipeline structure and stage capabilities.
     * **Reference** the extracted `expressions.docs.txt` on-demand for specific function overloads and parameters.

--------------------------------------------------------------------------------

## 3. Pipeline Examples

### Relational Joins Pattern

When querying related data (e.g., articles and their author profiles), perform the join at the database level via pipeline stages instead of executing multiple sequential lookups on the client-side.
*   Use `.define()` to bind parameters or document properties as variables.
*   Use `.addFields()` and a nested subquery with a matching filter.
*   Use `.toScalarExpression()` to convert a nested pipeline subquery to a single field value.
*   Assign variable and field aliases using `.alias(...)` (note: while the Web SDK uses `.as()`, the Kotlin SDK uses `.alias()` to avoid keyword conflicts with Kotlin's `as` operator).

```kotlin
import com.google.firebase.firestore.pipeline.Expression.field
import com.google.firebase.firestore.pipeline.Expression.variable

// Fetch articles and join the associated author Profile side-by-side
val articlesWithAuthProfile = db.pipeline().collection("articles")
    .define(field("authorUid").alias("author_id"))
    .addFields(
        db.pipeline().collection("users")
            .where(field("__name__").documentId().equalTo(variable("author_id")))
            .select(field("displayName"), field("avatarUrl"), field("handle"))
            .toScalarExpression()
            .alias("author")
    )
```

### Full-Text Search

Leverage the database-native `.search()` stage within your pipelines to run high-performance text query matches on the database level.

```kotlin
import com.google.firebase.firestore.pipeline.Expression.documentMatches
import com.google.firebase.firestore.pipeline.Expression.score

// Execute full-text search inside a pipeline, sorted by relevance score descending
val searchPipeline = db.pipeline()
    .collection("articles")
    .search(
        query = documentMatches("machine learning"),
        sort = score().descending()
    )
    .limit(5)
```

--------------------------------------------------------------------------------

## 4. Real-Time Listener & Document Operations

When real-time data sync or transaction-based document mutations are strictly required by application specifications, write clean operations as shown in this comprehensive example.

```kotlin
import android.util.Log
import com.google.firebase.Firebase
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.firestore

val db = Firebase.firestore
// 1. Add a new document to a collection
val taskData = hashMapOf(
    "title" to "Refactor Android SDK Usage Guide",
    "status" to "pending"
)

db.collection("tasks")
    .add(taskData)
    .addOnSuccessListener { documentReference ->
        val taskId = documentReference.id
        Log.d("Firestore", "Document added with ID: $taskId")

        // 2. Update specific fields of an existing document without replacing it
        db.collection("tasks").document(taskId)
            .update("priority", "high")
            .addOnSuccessListener {
                Log.d("Firestore", "Document successfully updated!")
            }
            .addOnFailureListener { e ->
                Log.w("Firestore", "Error updating document", e)
            }
    }
    .addOnFailureListener { e ->
        Log.w("Firestore", "Error adding document", e)
    }

// 3. Establish a real-time listener on a collection query
db.collection("tasks")
    .whereEqualTo("status", "pending")
    .addSnapshotListener { snapshot, error ->
        if (error != null) {
            Log.w("Firestore", "Listen failed.", error)
            return@addSnapshotListener
        }

        snapshot?.documentChanges?.forEach { change ->
            val docId = change.document.id
            val docData = change.document.data
            when (change.type) {
                DocumentChange.Type.ADDED -> {
                    Log.d("Firestore", "Added Task: $docId => $docData")
                }
                DocumentChange.Type.MODIFIED -> {
                    Log.d("Firestore", "Updated Task: $docId => $docData")
                }
                DocumentChange.Type.REMOVED -> {
                    Log.d("Firestore", "Removed Task: $docId => $docData")
                }
            }
        }
    }
```
