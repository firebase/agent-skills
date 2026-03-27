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
