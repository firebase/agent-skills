# Angular SSR Firebase Reference

When building with Angular Universal/SSR, properly initializing Firebase per-request prevents cross-contamination.

## 1. Initializing the Server App

Access the underlying Express `Request` object injected via the `REQUEST` token in Angular SSR.

```typescript
import { Injectable, Inject, Optional } from '@angular/core';
import { REQUEST } from '@nguniversal/express-engine/tokens';
import { Request } from 'express';
import { initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

@Injectable({ providedIn: 'root' })
export class FirebaseSSRService {
  constructor(@Optional() @Inject(REQUEST) private request: Request) {}

  public initializeApp() {
    const firebaseConfig = {
      apiKey: "...",
      authDomain: "...",
      projectId: "...",
      // ...
    };
    
    // Extract custom Auth token securely from the injected HTTP request context
    const authHeader = this.request?.headers['authorization'];
    const authIdToken = authHeader ? authHeader.split('Bearer ')[1] : undefined;

    const app = initializeServerApp(firebaseConfig, {
      authIdToken: authIdToken,
      releaseOnDeref: this.request
    });

    return { 
      app, 
      auth: getAuth(app), 
      db: getFirestore(app) 
    };
  }
}
```

## 2. Firestore Serialization

When bridging server state over to the client browser via Angular `TransferState` or Signals, complex instances (`Timestamp` and `GeoPoint`) must be mapped to primitive JS types.

```typescript
// auth.service.ts
import { TransferState, makeStateKey } from '@angular/core';

import { User } from 'firebase/auth';
const USER_DATA_KEY = makeStateKey<User | null>('user_data_SSR');

// In your Server Service resolving FireStore data
const docSnap = await getDoc(doc(db, "users", "123"));
const data = docSnap.data();

if (data) {
  // Convert Firestore types to serialization-friendly primitives
  const serializableData = {
    ...data,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };

  // Safe to transfer!
  this.transferState.set(USER_DATA_KEY, serializableData);
}
```

## 3. Data Connect Serialization

Firebase Data Connect returns standard JSON responses via its GraphQL endpoints. You do not need to do any serialization mapping before pushing the responses into a Signal or transferring them via Angular `TransferState`.

```typescript
import { listAllMenuItems } from '@firebasegen/default-connector';
import { TransferState, makeStateKey, Injectable } from '@angular/core';

interface MenuItem { id: string; title: string; url: string; }
const MENU_KEY = makeStateKey<MenuItem[]>('menu_ssr_state');

@Injectable({ providedIn: 'root' })
export class MenuService {
  constructor(private transferState: TransferState) {}

  async fetchMenuFromDataConnect() {
    const response = await listAllMenuItems();
    
    // 'response.data.menuItems' is already primitive JSON!
    this.transferState.set(MENU_KEY, response.data.menuItems);
  }
}
```

## 4. Realtime Database (RTDB)

Realtime Database snapshots are natively JSON-serializable, allowing them to be pushed directly into standard Angular mechanisms like `TransferState` without type massaging.

```typescript
import { getDatabase, ref, get } from "firebase/database";
import { TransferState, makeStateKey, Injectable } from '@angular/core';

interface ConfigState { featureFlag: boolean; version: string; }
const RTDB_KEY = makeStateKey<ConfigState | null>('rtdb_state');

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  constructor(
    private transferState: TransferState,
    private ssrContext: FirebaseSSRService // From Step 1
  ) {}

  async fetchLeaderboard() {
    const { app } = this.ssrContext.initializeApp();
    const db = getDatabase(app);
    
    const snapshot = await get(ref(db, "leaderboard"));
    const data = snapshot.val(); // Fully serializable JSON

    this.transferState.set(RTDB_KEY, data);
  }
}
```

## 5. Cloud Storage for Firebase

You can securely retrieve download URLs for Storage objects by passing the context-aware app to `getStorage`.

```typescript
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { TransferState, makeStateKey, Injectable } from '@angular/core';

const AVATAR_KEY = makeStateKey<string>('avatar_url_state');

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor(
    private transferState: TransferState,
    private ssrContext: FirebaseSSRService
  ) {}

  async fetchUserAvatar() {
    const { app } = this.ssrContext.initializeApp();
    const storage = getStorage(app);
    
    const fileRef = ref(storage, "users/me/avatar.png");
    const url = await getDownloadURL(fileRef);

    this.transferState.set(AVATAR_KEY, url);
  }
}
```

## 6. Cloud Functions

You can securely invoke Firebase HTTP Callable functions natively on the server on behalf of the requesting user.

```typescript
import { getFunctions, httpsCallable } from "firebase/functions";
import { TransferState, makeStateKey, Injectable } from '@angular/core';

interface SubscriptionResult { id: string; status: string; }
const FUNC_RES_KEY = makeStateKey<SubscriptionResult | null>('func_res_state');

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  constructor(
    private transferState: TransferState,
    private ssrContext: FirebaseSSRService
  ) {}

  async checkoutTier(plan: string) {
    const { app } = this.ssrContext.initializeApp();
    const functions = getFunctions(app);
    
    const createSubscription = httpsCallable(functions, 'createSubscription');
    const result = await createSubscription({ plan });

    this.transferState.set(FUNC_RES_KEY, result.data);
  }
}
```

## 7. Resuming Server Context in the Client

To avoid client-side layout shifts and redundant network requests, resume the server-initialized Firebase state within your Angular components using `TransferState`.

### Firebase Auth Hydration
Instead of rendering a blank loading screen while `onAuthStateChanged` resolves, evaluate the user from cookies on the server, store it in `TransferState`, and use it as the initial signal state on the client.

```typescript
// auth.service.ts
import { Injectable, TransferState, makeStateKey, PLATFORM_ID, Inject, signal } from '@angular/core';
import { isServer } from '@angular/common';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from './firebase.client'; // Standard initializeApp

const USER_STATE_KEY = makeStateKey<User | null>('auth_user_state');

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Initialize signal synchronously with the server-transferred state (if available)
  readonly currentUser = signal<User | null>(
    this.transferState.get(USER_STATE_KEY, null)
  );

  constructor(
    private transferState: TransferState,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isServer(this.platformId)) {
      // Logic running on server: Decode cookie/token and set TransferState
      // (This usually happens in an APP_INITIALIZER or server resolver)
      // this.transferState.set(USER_STATE_KEY, decodedUser);
    } else {
      // Logic running on client: Listen to actual SDK state changes
      const auth = getAuth(app);
      onAuthStateChanged(auth, (user) => {
        this.currentUser.set(user);
      });
    }
  }
}
```

### Firestore `onSnapshotResume`
To instantly render streaming Firestore data without a second network trip, use the Firebase JS SDK v10+ `onSnapshotResume` API. Extract the `.toJSON()` snapshot from the server, transfer it, and resume it.

```typescript
// posts.service.ts
import { Injectable, TransferState, makeStateKey, PLATFORM_ID, Inject, signal } from '@angular/core';
import { isServer } from '@angular/common';
import { getFirestore, onSnapshotResume, collection, query, getDocs } from 'firebase/firestore';
import { app } from './firebase.client';
import { FirebaseSSRService } from './firebase-ssr.service';

interface Post { id: string; title: string; content: string }
const SNAPSHOT_KEY = makeStateKey<Record<string, unknown>>('firestore_snapshot');

@Injectable({ providedIn: 'root' })
export class PostService {
  readonly posts = signal<Post[]>([]);

  constructor(
    private transferState: TransferState,
    @Inject(PLATFORM_ID) private platformId: Object,
    private ssrContext: FirebaseSSRService
  ) {}

  async fetchAndListenPosts() {
    if (isServer(this.platformId)) {
      // Server: Fetch snapshot and serialize via .toJSON()
      const { app } = this.ssrContext.initializeApp();
      const db = getFirestore(app);
      const q = query(collection(db, "posts"));
      const snapshot = await getDocs(q);
      
      this.transferState.set(SNAPSHOT_KEY, snapshot.toJSON());
    } else {
      // Client: Resume snapshot from TransferState
      const serializedSnapshot = this.transferState.get(SNAPSHOT_KEY, null);
      if (serializedSnapshot) {
        const db = getFirestore(app);
        onSnapshotResume(db, serializedSnapshot, (snapshot) => {
          this.posts.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }
    }
  }
}
```

### Data Connect `subscribe` Resumption
Firebase Data Connect's JS SDK uses a similar architecture to `onSnapshotResume` to hydrate client-side watches from server results. You can serialize the `.toJSON()` representation of the query result into `TransferState`, and pass it directly into the generated `subscribe` function.

```typescript
// movies.service.ts
import { Injectable, TransferState, makeStateKey, PLATFORM_ID, Inject, signal } from '@angular/core';
import { isServer } from '@angular/common';
import { listMovies, ListMoviesData, ListMoviesVariables } from '@movie-app/dataconnect';
import { subscribe, SerializedRef } from 'firebase/data-connect';
import { FirebaseSSRService } from './firebase-ssr.service';

const QUERY_KEY = makeStateKey<SerializedRef<ListMoviesData, ListMoviesVariables>>('dataconnect_query_snapshot');

@Injectable({ providedIn: 'root' })
export class MoviesService {
  // Use the extracted raw data as your initial state for 0 layout shift
  readonly movies = signal<ListMoviesData['movies']>(
    this.transferState.get(QUERY_KEY, undefined)?.data?.movies ?? []
  );

  constructor(
    private transferState: TransferState,
    @Inject(PLATFORM_ID) private platformId: Object,
    private ssrContext: FirebaseSSRService
  ) {}

  async fetchAndListenMovies() {
    if (isServer(this.platformId)) {
      // Server: Fetch QueryResult and serialize via .toJSON()
      this.ssrContext.initializeApp();
      const result = await listMovies();
      
      this.transferState.set(QUERY_KEY, result.toJSON());
    } else {
      // Client: Resume subscription from TransferState SerializedRef
      const serializedQuery = this.transferState.get(QUERY_KEY, null);
      if (serializedQuery) {
        subscribe(serializedQuery, {
          onNext: (res) => this.movies.set(res.data.movies)
        });
      }
    }
  }
}
```
