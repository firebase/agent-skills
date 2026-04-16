# Remix Firebase SSR Reference

When building with Remix, leverage `loader` and `action` functions to securely initialize Firebase contextually on the server.

## 1. Initializing the Server App

Extract custom tokens or session IDs using the `request` argument injected automatically by Remix.

```tsx
import { initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export async function setupFirebaseSSR(request: Request) {
  const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // ...
  };
  
  // Extract custom Auth token using standard Fetch API Headers
  const authHeader = request.headers.get('Authorization');
  const authIdToken = authHeader?.split('Bearer ')[1];

  const app = initializeServerApp(firebaseConfig, {
    authIdToken: authIdToken,
    releaseOnDeref: request
  });

  return { 
    app, 
    auth: getAuth(app), 
    db: getFirestore(app) 
  };
}
```

## 2. Firestore Serialization

When using standard `json()` loader responses to export data to your Remix Route Components, remember that `Timestamp` is not JSON-serializable.

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { doc, getDoc } from "firebase/firestore";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { db } = await setupFirebaseSSR(request);
  const docSnap = await getDoc(doc(db, "posts", "some_id"));
  const data = docSnap.data();

  if (!data) throw new Response("Not Found", { status: 404 });

  // Map out non-serializable fields
  const post = {
    ...data,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };

  return json({ post });
}

export default function PostRoute() {
  const { post } = useLoaderData<typeof loader>();
  
  return (
    <article>
      <h1>{post.title}</h1>
      <p>Created on: {new Date(post.createdAt).toLocaleDateString()}</p>
    </article>
  );
}
```

## 3. Data Connect Serialization

Firebase Data Connect returns standard JSON responses via its GraphQL endpoints. You do not need to serialize `timestamps` when calling Data Connect generated functions.

```tsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { listAllMenuItems } from '@firebasegen/default-connector';

export async function loader() {
  const response = await listAllMenuItems();
  
  // Data connect responses are inherently serializable!
  return json({ menuItems: response.data.menuItems });
}

export default function MenuRoute() {
  const { menuItems } = useLoaderData<typeof loader>();
  
  return (
    <ul>
      {menuItems.map(item => <li key={item.id}>{item.name}</li>)}
    </ul>
  );
}
```

## 4. Realtime Database (RTDB)

Realtime Database snapshots are natively JSON-serializable, allowing them to be returned directly inside Remix `json()` loaders.

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getDatabase, ref, get } from "firebase/database";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { app } = await setupFirebaseSSR(request);
  const db = getDatabase(app);
  
  const snapshot = await get(ref(db, "leaderboard"));
  const data = snapshot.val(); // Fully serializable JSON

  return json({ leaderboardData: data });
}

export default function RealtimeDataRoute() {
  const { leaderboardData } = useLoaderData<typeof loader>();
  
  return <pre>{JSON.stringify(leaderboardData, null, 2)}</pre>;
}
```

## 5. Cloud Storage for Firebase

You can securely retrieve download URLs for Storage objects within a loader before the page renders to the user.

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { app } = await setupFirebaseSSR(request);
  const storage = getStorage(app);
  
  const fileRef = ref(storage, "users/me/avatar.png");
  const url = await getDownloadURL(fileRef);

  return json({ avatarUrl: url });
}

export default function StorageRoute() {
  const { avatarUrl } = useLoaderData<typeof loader>();
  
  return <img src={avatarUrl} alt="User Avatar" />;
}
```

## 6. Cloud Functions

You can securely invoke Firebase HTTP Callable functions natively on the server during an `action` or `loader`.

```tsx
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { getFunctions, httpsCallable } from "firebase/functions";

export async function action({ request }: ActionFunctionArgs) {
  const { app } = await setupFirebaseSSR(request);
  const functions = getFunctions(app);
  
  const formData = await request.formData();
  const plan = formData.get("plan");

  const createSubscription = httpsCallable(functions, 'createSubscription');
  const result = await createSubscription({ plan });

  return json({ subscriptionResult: result.data });
}
```

## 7. Resuming Server Context in the Client

To avoid client-side layout shifts and redundant network requests, resume the server-initialized Firebase state within your Remix components.

### Firebase Auth Hydration
Instead of rendering a blank loading screen while `onAuthStateChanged` resolves, pass the decoded user state (from your session cookie inside the `loader`) down via `useLoaderData` to initialize your React context.

```tsx
import { useEffect, useState } from "react";
import { useLoaderData } from "@remix-run/react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app } from "~/firebaseClient"; // standard initializeApp setup

export default function Root() {
  // initialUser is extracted from the session cookie in your root loader
  const { initialUser } = useLoaderData<typeof loader>();
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, setUser);
  }, []);

  return <AuthContext.Provider value={user}><Outlet /></AuthContext.Provider>;
}
```

### Firestore `onSnapshotResume`
To instantly render streaming Firestore data without a second network trip, use the Firebase JS SDK v10+ `onSnapshotResume` API. Return the internal `.toJSON()` representation from your `loader`.

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getFirestore, collection, getDocs, query, onSnapshotResume } from "firebase/firestore";
import { useEffect, useState } from "react";
import { app } from "~/firebaseClient";

export async function loader({ request }: LoaderFunctionArgs) {
  const { app } = await setupFirebaseSSR(request);
  const db = getFirestore(app);
  
  const q = query(collection(db, "posts"));
  const snapshot = await getDocs(q);

  // Pass the internal .toJSON() representation of the snapshot to the client
  return json({ serializedSnapshot: snapshot.toJSON() });
}

export default function PostRoute() {
  const { serializedSnapshot } = useLoaderData<typeof loader>();
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
Firebase Data Connect's JS SDK uses a similar architecture to `onSnapshotResume` to hydrate client-side watches from server results. You can return the `.toJSON()` serialized representation of the query result from your loader, and pass it directly into the generated `subscribe` function.

```tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { subscribe, SerializedRef } from 'firebase/data-connect';
import { listMovies, ListMoviesData, ListMoviesVariables } from '@movie-app/dataconnect';

export async function loader({ request }: LoaderFunctionArgs) {
  await setupFirebaseSSR(request);
  
  const result = await listMovies(); 
  
  // Pass the internal .toJSON() SerializedRef representation to the client
  return json({ serializedQuery: result.toJSON() });
}

export default function MoviesRoute() {
  const { serializedQuery } = useLoaderData<typeof loader>() as { serializedQuery: SerializedRef<ListMoviesData, ListMoviesVariables> };
  
  // Use the extracted raw data as your initial state for 0 layout shift
  const [movies, setMovies] = useState(serializedQuery.data.movies);

  useEffect(() => {
    // Resume the subscription utilizing the serialized reference state
    const unsubscribe = subscribe(serializedQuery, {
      onNext: (res) => setMovies(res.data.movies)
    });

    return unsubscribe;
  }, [serializedQuery]);

  return <div>{movies.map(m => <div key={m.id}>{m.title}</div>)}</div>;
}
```
