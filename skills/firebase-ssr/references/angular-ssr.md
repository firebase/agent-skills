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
      authIdToken: authIdToken
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

const USER_DATA_KEY = makeStateKey<any>('user_data_SSR');

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

const MENU_KEY = makeStateKey<any[]>('menu_ssr_state');

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
