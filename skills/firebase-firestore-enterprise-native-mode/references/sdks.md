# Firestore SDK Usage Guide

## Contents
- [Web SDK](#web-sdk)
- [Python Server SDK](#python-server-sdk)

---

## Web SDK

This guide focuses on the **Modular Web SDK** (v9+), which is tree-shakeable and efficient.

### Initialization

```javascript
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// If running in Firebase App Hosting, you can skip Firebase Config and instead use:
// const app = initializeApp();

const firebaseConfig = {
  // Your config options. Get the values by running 'firebase apps:sdkconfig <platform> <app-id>'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
```

### Writing Data

#### Set a Document
Creates a document if it doesn't exist, or overwrites it if it does. You can also specify a merge option to only update provided fields.

```javascript
import { doc, setDoc } from "firebase/firestore"; 

// Create/Overwrite document with ID "LA"
await setDoc(doc(db, "cities", "LA"), {
  name: "Los Angeles",
  state: "CA",
  country: "USA"
});

// To merge with existing data instead of overwriting:
await setDoc(doc(db, "cities", "LA"), { population: 3900000 }, { merge: true });
```

#### Add a Document with Auto-ID
Use when you don't care about the document ID and want Firestore to automatically generate one.

```javascript
import { collection, addDoc } from "firebase/firestore"; 

const docRef = await addDoc(collection(db, "cities"), {
  name: "Tokyo",
  country: "Japan"
});
console.log("Document written with ID: ", docRef.id);
```

#### Update a Document
Update some fields of an existing document without overwriting the entire document. Fails if the document doesn't exist.

```javascript
import { doc, updateDoc } from "firebase/firestore";

const laRef = doc(db, "cities", "LA");

await updateDoc(laRef, {
  capital: true
});
```

#### Transactions
Perform an atomic read-modify-write operation.

```javascript
import { runTransaction, doc } from "firebase/firestore";

const sfDocRef = doc(db, "cities", "SF");

try {
  await runTransaction(db, async (transaction) => {
    const sfDoc = await transaction.get(sfDocRef);
    if (!sfDoc.exists()) {
      throw "Document does not exist!";
    }

    const newPopulation = sfDoc.data().population + 1;
    transaction.update(sfDocRef, { population: newPopulation });
  });
  console.log("Transaction successfully committed!");
} catch (e) {
  console.log("Transaction failed: ", e);
}
```

### Reading Data

#### Get a Single Document

```javascript
import { doc, getDoc } from "firebase/firestore";

const docRef = doc(db, "cities", "SF");
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {
  console.log("Document data:", docSnap.data());
} else {
  console.log("No such document!");
}
```

#### Get Multiple Documents
Fetches all documents in a query or collection once.

```javascript
import { collection, getDocs } from "firebase/firestore";

const querySnapshot = await getDocs(collection(db, "cities"));
querySnapshot.forEach((doc) => {
  console.log(doc.id, " => ", doc.data());
});
```

### Realtime Updates

#### Listen to a Document or Query

```javascript
import { doc, onSnapshot } from "firebase/firestore";

const unsub = onSnapshot(doc(db, "cities", "SF"), (doc) => {
    console.log("Current data: ", doc.data());
});

// To stop listening: 
// unsub();
```

### Handle Changes

```javascript
import { collection, query, where, onSnapshot } from "firebase/firestore";

const q = query(collection(db, "cities"), where("state", "==", "CA"));
const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
        console.log("New city: ", change.doc.data());
    }
    if (change.type === "modified") {
        console.log("Modified city: ", change.doc.data());
    }
    if (change.type === "removed") {
        console.log("Removed city: ", change.doc.data());
    }
  });
});
```

### Queries

#### Simple and Compound Queries
Use `query()` and `where()` to combine filters safely.

```javascript
import { collection, query, where, getDocs } from "firebase/firestore";

const citiesRef = collection(db, "cities");

// Simple equality
const q1 = query(citiesRef, where("state", "==", "CA"));

// Compound (AND)
// Note: Requires a composite index if filtering on different fields
const q2 = query(citiesRef, where("state", "==", "CA"), where("population", ">", 1000000));
```

#### Order and Limit
Sort and limit results cleanly.

```javascript
import { orderBy, limit } from "firebase/firestore";

const q = query(citiesRef, orderBy("name"), limit(3));
```

#### Pipeline Queries

You can use pipeline queries to perform complex queries.

```javascript

const readDataPipeline = db.pipeline()
  .collection("users");

// Execute the pipeline and handle the result
try {
  const querySnapshot = await execute(readDataPipeline);
  querySnapshot.results.forEach((result) => {
    console.log(`${result.id} => ${result.data()}`);
  });
} catch (error) {
    console.error("Error getting documents: ", error);
}
```

---

## Python Server SDK

The Python Server SDK is used for backend/server environments and utilizes Google Application Default Credentials in most Google Cloud environments.

### Writing Data

#### Set a Document
Creates a document if it does not exist or overwrites it if it does. You can also specify a merge option to only update provided fields.

```python
city_ref = db.collection("cities").document("LA")

# Create/Overwrite
city_ref.set({
    "name": "Los Angeles",
    "state": "CA",
    "country": "USA"
})

# Merge
city_ref.set({"population": 3900000}, merge=True)
```

#### Add a Document with Auto-ID
Use when you don't care about the document ID and want Firestore to automatically generate one.

```python
update_time, city_ref = db.collection("cities").add({
    "name": "Tokyo",
    "country": "Japan"
})
print("Document written with ID: ", city_ref.id)
```

#### Update a Document
Update some fields of an existing document without overwriting the entire document. Fails if the document doesn't exist.

```python
city_ref = db.collection("cities").document("LA")
city_ref.update({
    "capital": True
})
```

#### Transactions
Perform an atomic read-modify-write operation.

```python
from google.cloud.firestore import Transaction

transaction = db.transaction()
city_ref = db.collection("cities").document("SF")

@firestore.transactional
def update_in_transaction(transaction, city_ref):
    snapshot = city_ref.get(transaction=transaction)
    if not snapshot.exists:
        raise Exception("Document does not exist!")
    
    new_population = snapshot.get("population") + 1
    transaction.update(city_ref, {"population": new_population})

update_in_transaction(transaction, city_ref)
```

### Reading Data

#### Get a Single Document

```python
doc_ref = db.collection("cities").document("SF")
doc = doc_ref.get()

if doc.exists:
    print(f"Document data: {doc.to_dict()}")
else:
    print("No such document!")
```

#### Get Multiple Documents
Fetches all documents in a query or collection once.

```python
docs = db.collection("cities").stream()

for doc in docs:
    print(f"{doc.id} => {doc.to_dict()}")
```

### Queries

#### Simple and Compound Queries
Use `.where()` to combine filters safely. Stack `.where()` calls for compound queries.

```python
from google.cloud.firestore import FieldFilter

cities_ref = db.collection("cities")

# Simple equality
query_1 = cities_ref.where(filter=FieldFilter("state", "==", "CA"))

# Compound (AND)
query_2 = cities_ref.where(
    filter=FieldFilter("state", "==", "CA")
).where(
    filter=FieldFilter("population", ">", 1000000)
)
```

#### Order and Limit
Sort and limit results cleanly.

```python
query = cities_ref.order_by("name").limit(3)
```

#### Pipeline Queries

You can use pipeline queries to perform complex queries.

```python
pipeline = client.pipeline().collection("users")
for result in pipeline.execute():
    print(f"{result.id} => {result.data()}")
```