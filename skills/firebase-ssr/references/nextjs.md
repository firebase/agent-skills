# Next.js (App Router) Firebase SSR Reference

When building with Next.js App Router, utilize React Server Components (RSCs) alongside `initializeServerApp` to securely extract and pass data.

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
  
  // Extract custom Auth token using modern Next.js headers()
  const reqHeaders = await headers();
  const authIdToken = reqHeaders.get('authorization')?.split('Bearer ')[1];

  const app = initializeServerApp(firebaseConfig, {
    authIdToken: authIdToken
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
