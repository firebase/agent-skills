# Firebase Authentication - Android Setup Guide (Kotlin)

This guide describes the SDK setup and basic usage patterns for
Firebase Authentication in an Android app using
Kotlin DSL (`build.gradle.kts`) and Kotlin code.

## Prerequisites

IMPORTANT: Before specifically working with Firebase Authentication, make sure
to use the skill and reference `firebase_basics/references/android_setup` to
ensure the following is done.

- The Firebase CLI is available and authenticated.
- An Android project exists and is registered with a Firebase Project.
- The Android project has a Firebase config file (`google-services.json`) and
  the Google services Gradle plugin (`google-services`).

______________________________________________________________________

## 1. Enable Authentication via CLI

Enable the Firebase Authentication service in the Firebase Project using the
Firebase CLI:

```bash
npx -y firebase-tools@latest init auth
```

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
> # Find the latest firebase-auth version
> curl -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-auth/maven-metadata.xml | grep -oE '<latest>[^<]+' | cut -d'>' -f2
> ```
>
> If the dependency is already declared, fetch the exact resolved version
> currently active in the workspace's build graph:
>
> ```bash
> ./gradlew -q :app:dependencyInsight --dependency firebase-auth --configuration releaseRuntimeClasspath
> ```

In the **module (app-level)** `build.gradle.kts` (usually
`<project>/<app-module>/build.gradle.kts`), add the dependency for
Firebase Authentication:

```kotlin
dependencies {
    // [AGENT] Fetch the latest resolved version using the Gradle command above
    implementation(platform("com.google.firebase:firebase-bom:<latest_bom_version>"))

    // Add the dependency for the Firebase Authentication library
    // When using the BoM, don't specify versions in Firebase library dependencies
    implementation("com.google.firebase:firebase-auth")
}
```

______________________________________________________________________

## 3. Initialize FirebaseAuth

In the Activity or Fragment, initialize the `FirebaseAuth` instance:

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth

class MainActivity : AppCompatActivity() {

    private lateinit var auth: FirebaseAuth

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = Firebase.auth

        setContent {
            MaterialTheme {
                Text("Auth initialized!")
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
import com.google.firebase.auth.auth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val auth = Firebase.auth

        setContent {
            MaterialTheme {
                Text("Auth initialized!")
            }
        }
    }
}
```

______________________________________________________________________

## 4. Check current Auth state

Check if a user is already signed in when the activity starts:

```kotlin
public override fun onStart() {
    super.onStart()
    // Check if user is signed in (non-null) and update UI accordingly.
    val currentUser = auth.currentUser
    if (currentUser != null) {
        // User is signed in, navigate to main screen or update UI
    } else {
        // No user is signed in, prompt for login
    }
}
```

______________________________________________________________________

## 5. Use sign-in providers in the app

### Email/Password

#### Sign up NEW users with Email/Password

Use `createUserWithEmailAndPassword` to register new users:

```kotlin
fun signUpUser(email: String, password: String) {
    auth.createUserWithEmailAndPassword(email, password)
        .addOnCompleteListener(this) { task ->
            if (task.isSuccessful) {
                // Sign up success, update UI with the signed-in user's information
                val user = auth.currentUser
                // Navigate to main screen
            } else {
                // If sign up fails, display a message to the user.
                Toast.makeText(baseContext, "Authentication failed.", Toast.LENGTH_SHORT).show()
            }
        }
}
```

#### Sign in EXISTING users with Email/Password

Use `signInWithEmailAndPassword` to sign in existing users:

```kotlin
fun signInUser(email: String, password: String) {
    auth.signInWithEmailAndPassword(email, password)
        .addOnCompleteListener(this) { task ->
            if (task.isSuccessful) {
                // Sign in success, update UI with the signed-in user's information
                val user = auth.currentUser
                // Navigate to main screen
            } else {
                // If sign in fails, display a message to the user.
                Toast.makeText(baseContext, "Authentication failed.", Toast.LENGTH_SHORT).show()
            }
        }
}
```

______________________________________________________________________

## 6. Sign out users

To sign out a user, call `signOut()` on the `FirebaseAuth` instance:

```kotlin
auth.signOut()
// Navigate to login screen
```
