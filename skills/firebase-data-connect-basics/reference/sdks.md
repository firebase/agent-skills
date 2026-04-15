# SDK Reference

## Contents
- [SDK Generation](#sdk-generation)
- [Web SDK](#web-sdk)
- [Android SDK](#android-sdk)
- [iOS SDK](#ios-sdk)
- [Admin SDK](#admin-sdk)

---

## SDK Generation

Configure SDK generation in `connector.yaml`:

```yaml
connectorId: my-connector
generate:
  javascriptSdk:
    outputDir: "../web-app/src/lib/dataconnect"
    package: "@movie-app/dataconnect"
  kotlinSdk:
    outputDir: "../android-app/app/src/main/kotlin/com/example/dataconnect"
    package: "com.example.dataconnect"
  swiftSdk:
    outputDir: "../ios-app/DataConnect"
```

Generate SDKs:
```bash
npx -y firebase-tools@latest dataconnect:sdk:generate
```

---

## Web SDK

### Installation

```bash
npm install firebase
```

### Initialization

```typescript
import { initializeApp } from 'firebase/app';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { connectorConfig } from '@movie-app/dataconnect';

const app = initializeApp(firebaseConfig);
const dc = getDataConnect(app, connectorConfig);

// For local development
if (import.meta.env.DEV) {
  connectDataConnectEmulator(dc, 'localhost', 9399);
}
```

### Calling Operations

```typescript
// Generated SDK provides typed functions
import { listMovies, createMovie, getMovie } from '@movie-app/dataconnect';

// Accessing Nested Fields
const movie = await getMovie({ id: '...' });
// Relations are just properties on the object
const director = movie.data.movie.metadata.director; 
const firstActor = movie.data.movie.actors[0].name;

// Query
const result = await listMovies();
console.log(result.data.movies);

// Query with variables
const movie = await getMovie({ id: 'uuid-here' });

// Mutation
const newMovie = await createMovie({ 
  title: 'New Movie', 
  genre: 'Action' 
});
console.log(newMovie.data.movie_insert); // Returns key
```

### Subscriptions (Realtime)

Use `subscribe()` instead of `execute()` to receive live updates. This works with queries that use `@refresh` directives and with single-entity lookups that auto-refresh. The subscription yields current data immediately, then pushes delta updates when the server refreshes the query.

See [reference/realtime.md](realtime.md) for how to configure which queries refresh and when.

```typescript
import { listMoviesRef } from '@movie-app/dataconnect';
import { subscribe } from 'firebase/data-connect';

const unsubscribe = subscribe(listMoviesRef(), {
  onNext: (result) => {
    console.log('Movies updated:', result.data.movies);
  },
  onError: (error) => {
    console.error('Subscription error:', error);
  }
});

// Later: unsubscribe();
```

### Framework Example (React)

```typescript
import { useEffect, useState } from 'react';
import { listMoviesRef } from '@movie-app/dataconnect';
import { subscribe } from 'firebase/data-connect';

function MovieList() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const ref = listMoviesRef();
    const unsubscribe = subscribe(ref, {
      onNext: (result) => setMovies(result.data.movies),
      onError: (error) => console.error('Subscription error:', error)
    });
    return () => unsubscribe();
  }, []);

  return <ul>{movies.map(m => <li key={m.id}>{m.title}</li>)}</ul>;
}
```

### With Authentication

```typescript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth(app);
await signInWithEmailAndPassword(auth, email, password);

// SDK automatically includes auth token in requests
const myReviews = await myReviews(); // @auth(level: USER) query from examples.md
```

---

## Android SDK

### Dependencies (build.gradle.kts)

```kotlin
dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.0.0"))
    implementation("com.google.firebase:firebase-dataconnect")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.6.0")
}
```

### Initialization

```kotlin
import com.google.firebase.Firebase
import com.google.firebase.dataconnect.dataConnect
import com.example.dataconnect.MyConnector

val connector = MyConnector.instance

// For emulator
connector.dataConnect.useEmulator("10.0.2.2", 9399)
```

### Calling Operations

```kotlin
// Query
val result = connector.listMovies.execute()
result.data.movies.forEach { movie ->
    println(movie.title)
    // Access nested fields directly
    println(movie.metadata?.director)
    println(movie.actors.firstOrNull()?.name)
}

// Query with variables
val movie = connector.getMovie.execute(id = "uuid-here")

// Mutation
val newMovie = connector.createMovie.execute(
    title = "New Movie",
    genre = "Action"
)
```

### Flow Subscription (Realtime)

Use `flow()` to receive live updates from `@refresh`-enabled queries and auto-refreshing entity lookups. See [reference/realtime.md](realtime.md) for server-side configuration.

```kotlin
connector.listMovies.flow().collect { result ->
    when (result) {
        is DataConnectResult.Success -> updateUI(result.data.movies)
        is DataConnectResult.Error -> showError(result.exception)
    }
}
```

---

## iOS SDK

### Dependencies (Package.swift or SPM)

```swift
dependencies: [
    .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0")
]
// Add FirebaseDataConnect to target dependencies
```

### Initialization

```swift
import FirebaseCore
import FirebaseDataConnect

FirebaseApp.configure()
let connector = MyConnector.shared

// For emulator
connector.useEmulator(host: "localhost", port: 9399)
```

### Calling Operations

```swift
// Query
let result = try await connector.listMovies.execute()
for movie in result.data.movies {
    print(movie.title)
    // Access nested fields directly
    print(movie.metadata?.director ?? "Unknown")
    print(movie.actors.first?.name ?? "No actors")
}

// Query with variables
let movie = try await connector.getMovie.execute(id: "uuid-here")

// Mutation
let newMovie = try await connector.createMovie.execute(
    title: "New Movie",
    genre: "Action"
)
```

### Subscriptions (Realtime)

Initiate a real-time subscription to a query reference. Results are automatically published to the `data` property of the query reference, which can be observed in SwiftUI views.

```swift
// Initiate realtime subscription to a query ref
// Results are published to the data var of the query ref
_ = try await connector.listMovies.ref().subscribe()
```

---



## Admin SDK

Server-side operations with elevated privileges (bypasses @auth):

### Node.js

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';

initializeApp({
  credential: cert(serviceAccount)
});

const dc = getDataConnect();

// Execute operations (bypasses @auth)
const result = await dc.executeGraphql({
  query: `query { users { id email } }`,
  operationName: 'ListAllUsers'
});

// Or use generated Admin SDK
import { listAllUsers } from './admin-connector';
const users = await listAllUsers();
```

### Generate Admin SDK

In `connector.yaml`:

```yaml
generate:
  nodeAdminSdk:
    outputDir: "./admin-sdk"
    package: "@app/admin-dataconnect"
```

Generate:
```bash
npx -y firebase-tools@latest dataconnect:sdk:generate
```
