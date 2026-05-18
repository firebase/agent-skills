# Next.js (App Router) Firebase SSR Reference

When building with Next.js App Router, utilize React Server Components (RSCs) alongside `initializeServerApp` to securely extract and pass data.

## Cache Components
Currently, cached components are not supported. If the user is using Next.js v16, ensure that the `cacheComponents` is set to `false` in `next.config.ts`.

## 1. Initializing the Server App

Use the standard Next.js `headers()` or `cookies()` APIs to retrieve tokens for Firebase Auth without accessing the Express request object.

```tsx
import { initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { headers } from "next/headers";

export async function setupFirebaseSSR() {
  const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // ...
  };
  
  // Extract custom Auth token and App Check token using modern Next.js headers()
  const reqHeaders = await headers();
  const authIdToken = reqHeaders.get('authorization')?.split('Bearer ')[1];
  const appCheckToken = reqHeaders.get('x-firebase-appcheck');

  const app = initializeServerApp(firebaseConfig, {
    authIdToken: authIdToken,
    appCheckToken: appCheckToken,
    releaseOnDeref: reqHeaders
  });

  return { 
    app, 
    auth: getAuth(app), 
    db: getFirestore(app) 
  };
}
```

## 2. Firestore Serialization

When calling `getFirestore` from the Server and passing data into Client Components (`"use client"`), props must be serializable JSON. `Timestamp` or `GeoPoint` objects will throw an error during the Next.js build or SSR phase if they are not explicitly serialized.

```tsx
// app/page.tsx (Server Component)
import { doc, getDoc } from "firebase/firestore";
import ClientComponent from './ClientComponent';

export default async function Page() {
  const { db } = await setupFirebaseSSR();
  const docSnap = await getDoc(doc(db, "users", "123"));
  const data = docSnap.data();

  if (!data) return null;

  // Convert Firestore types to standard JS primitives
  const serializableData = {
    ...data,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };

  return <ClientComponent data={serializableData} />;
}
```

## 3. Data Connect Serialization

Firebase Data Connect returns standard JSON responses via its GraphQL endpoints. You do not need to do any mapping or serialization before passing responses as props in Server Components.

```tsx
// app/menu/page.tsx (Server Component)
import { listAllMenuItems } from '@firebasegen/default-connector';
import { MenuList } from './client-components/MenuList';

export default async function MenuPage() {
  const response = await listAllMenuItems();

  // 'response.data.menuItems' is already primitive JSON!
  return (
    <main>
      <h1>Menu</h1>
      <MenuList items={response.data.menuItems} />
    </main>
  );
}
```

## 4. Realtime Database (RTDB)

Realtime Database snapshots are natively JSON-serializable, making them straightforward to pass to Client Components without complex mappings.

```tsx
// app/rtdb/page.tsx (Server Component)
import { getDatabase, ref, get } from "firebase/database";
import ClientComponent from './ClientComponent';

export default async function RealtimeDataPage() {
  const { app } = await setupFirebaseSSR();
  const db = getDatabase(app);
  
  const snapshot = await get(ref(db, "leaderboard"));
  const data = snapshot.val(); // Fully serializable JSON

  return <ClientComponent leaderboardData={data} />;
}
```

## 5. Cloud Storage for Firebase

You can securely retrieve download URLs for Storage objects on the server leveraging the user's isolated context.

```tsx
// app/storage/page.tsx (Server Component)
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import Image from "next/image";

export default async function StorageImagePage() {
  const { app } = await setupFirebaseSSR();
  const storage = getStorage(app);
  
  const fileRef = ref(storage, "users/me/avatar.png");
  const url = await getDownloadURL(fileRef);

  return <Image src={url} alt="User Avatar" width={100} height={100} />;
}
```

## 6. Cloud Functions

You can securely invoke Firebase HTTP Callable functions natively on the server before rendering the UI.

```tsx
// app/functions/page.tsx (Server Component)
import { getFunctions, httpsCallable } from "firebase/functions";
import ClientComponent from './ClientComponent';

export default async function FunctionsPage() {
  const { app } = await setupFirebaseSSR();
  const functions = getFunctions(app);
  
  const createSubscription = httpsCallable(functions, 'createSubscription');
  const result = await createSubscription({ plan: "premium" });

  return <ClientComponent subscriptionResult={result.data} />;
}
```

## 7. Resuming Server Context in the Client

To avoid client-side layout shifts and redundant network requests, resume the server-initialized Firebase state within your Next.js Client Components.

### Firebase Auth Hydration
Instead of rendering a blank loading screen while `onAuthStateChanged` resolves, pass the decoded user state (from your session cookie or `headers()`) down as a prop to your React context.

```tsx
// app/ClientAuthProvider.tsx (Client Component)
"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app } from "./firebaseClient"; // standard initializeApp setup

export function ClientAuthProvider({ initialUser, children }: { initialUser: User | null, children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, setUser);
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
```

### Firestore `onSnapshotResume`
To instantly render streaming Firestore data without a second network trip, use the Firebase JS SDK v10+ `onSnapshotResume` API.

```tsx
// app/page.tsx (Server Component)
import { getFirestore, collection, getDocs, query } from "firebase/firestore";

export default async function Page() {
  const { app } = await setupFirebaseSSR();
  const db = getFirestore(app);
  
  const q = query(collection(db, "posts"));
  const snapshot = await getDocs(q);

  // Pass the internal .toJSON() representation of the snapshot to the client
  return <PostList serializedSnapshot={snapshot.toJSON()} />;
}
```

```tsx
// app/PostList.tsx (Client Component)
"use client";
import { useEffect, useState } from "react";
import { getFirestore, onSnapshotResume } from "firebase/firestore";
import { app } from "./firebaseClient";

export default function PostList({ serializedSnapshot }: { serializedSnapshot: object }) {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const db = getFirestore(app);
    
    // Resume the listener from the server's snapshot state seamlessly
    const unsubscribe = onSnapshotResume(db, serializedSnapshot, (snapshot) => {
      setDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return unsubscribe;
  }, [serializedSnapshot]);

  return <div>{docs.map(d => <div key={d.id}>{d.title}</div>)}</div>;
}
```

### Data Connect `subscribe` Resumption
Firebase Data Connect's JS SDK uses a similar architecture to `onSnapshotResume` to hydrate client-side watches from server results. You can pass the serialized representation of the query result directly into the generated `subscribe` function.

```tsx
// app/movies/page.tsx (Server Component)
import { listMovies } from '@movie-app/dataconnect';

export default async function MoviesPage() {
  await setupFirebaseSSR(); // Request-isolated app injection
  
  const result = await listMovies(); // Internal QueryResult object
  
  // Pass the internal .toJSON() SerializedRef representation to the client
  return <MoviesList serializedQuery={result.toJSON()} />;
}
```

```tsx
// app/movies/MoviesList.tsx (Client Component)
"use client";
import { useEffect, useState } from "react";
import { subscribe, SerializedRef } from 'firebase/data-connect';
import { ListMoviesData, ListMoviesVariables } from '@movie-app/dataconnect';

export default function MoviesList({ serializedQuery }: { serializedQuery: SerializedRef<ListMoviesData, ListMoviesVariables> }) {
  // Use the extracted raw data as your initial state for 0 layout shift
  const [movies, setMovies] = useState(serializedQuery.data.movies);

  useEffect(() => {
    // Resume the subscription utilizing the serialized reference state
    // Without recreating the query context from scratch
    const unsubscribe = subscribe(serializedQuery, {
      onNext: (res) => setMovies(res.data.movies)
    });

    return unsubscribe;
  }, [serializedQuery]);

  return <div>{movies.map(m => <div key={m.id}>{m.title}</div>)}</div>;
}
```
