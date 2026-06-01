# Advanced Features Reference

## Contents
- [Vector Similarity Search](#vector-similarity-search)
- [Full-Text Search](#full-text-search)
- [Cloud Functions Integration](#cloud-functions-integration)
- [Data Seeding & Bulk Operations](#data-seeding--bulk-operations)

---

## Vector Similarity Search

Semantic search using Vertex AI embeddings and PostgreSQL's `pgvector`.

### Schema Setup

```graphql
type Movie @table {
  id: UUID! @default(expr: "uuidV4()")
  title: String!
  description: String
  # Vector field for embeddings - size must match model output (768 for gecko)
  descriptionEmbedding: Vector! @col(size: 768)
}
```

### Generate Embeddings in Mutations

Use `_embed` server value to auto-generate embeddings via Vertex AI:

```graphql
mutation CreateMovieWithEmbedding($title: String!, $description: String!) 
  @auth(level: USER) {
  movie_insert(data: {
    title: $title,
    description: $description,
    descriptionEmbedding_embed: {
      model: "textembedding-gecko@003",
      text: $description
    }
  })
}
```

### Similarity Search Query

SQL Connect generates `_similarity` fields for Vector columns:

```graphql
query SearchMovies($query: String!) @auth(level: PUBLIC) {
  movies_descriptionEmbedding_similarity(
    compare_embed: { model: "textembedding-gecko@003", text: $query },
    method: L2,         # L2, COSINE, or INNER_PRODUCT
    within: 2.0,        # Max distance threshold
    limit: 5
  ) {
    id
    title
    description
    _metadata { distance }  # See how close each result is
  }
}
```

### Similarity Parameters

| Parameter | Description |
|-----------|-------------|
| `compare` | Raw Vector to compare against |
| `compare_embed` | Generate embedding from text via Vertex AI |
| `method` | Distance function: `L2`, `COSINE`, `INNER_PRODUCT` |
| `within` | Max distance (results further are excluded) |
| `where` | Additional filters |
| `limit` | Max results to return |

### Custom Embeddings

Pass pre-computed vectors directly:

```graphql
mutation StoreCustomEmbedding($id: UUID!, $embedding: Vector!) @auth(level: USER) {
  movie_update(id: $id, data: { descriptionEmbedding: $embedding })
}

query SearchWithCustomVector($vector: Vector!) @auth(level: PUBLIC) {
  movies_descriptionEmbedding_similarity(
    compare: $vector,
    method: COSINE,
    limit: 10
  ) { id title }
}
```

---

## Full-Text Search

Fast keyword/phrase search using PostgreSQL's full-text capabilities.

### Enable with @searchable

```graphql
type Movie @table {
  title: String! @searchable
  description: String @searchable(language: "english")
  genre: String @searchable
}
```

### Search Query

SQL Connect generates `_search` fields:

```graphql
query SearchMovies($query: String!) @auth(level: PUBLIC) {
  movies_search(
    query: $query,
    queryFormat: QUERY,  # QUERY, PLAIN, PHRASE, or ADVANCED
    limit: 20
  ) {
    id title description
    _metadata { relevance }  # Relevance score
  }
}
```

### Query Formats

| Format | Description |
|--------|-------------|
| `QUERY` | Web-style (default): quotes, AND, OR supported |
| `PLAIN` | Match all words, any order |
| `PHRASE` | Match exact phrase |
| `ADVANCED` | Full tsquery syntax |

### Tuning Results

```graphql
query SearchWithThreshold($query: String!) @auth(level: PUBLIC) {
  movies_search(
    query: $query,
    relevanceThreshold: 0.05,  # Min relevance score
    where: { genre: { eq: "Action" }},
    orderBy: [{ releaseYear: DESC }]
  ) { id title }
}
```

### Supported Languages

`english` (default), `french`, `german`, `spanish`, `italian`, `portuguese`, `dutch`, `danish`, `finnish`, `norwegian`, `swedish`, `russian`, `arabic`, `hindi`, `simple`

---

## Cloud Functions Integration

Trigger Cloud Functions when mutations execute.

### Basic Trigger (Node.js)

```typescript
import { onMutationExecuted } from "firebase-functions/dataconnect";
import { logger } from "firebase-functions";

export const onUserCreate = onMutationExecuted(
  {
    service: "myService",
    connector: "default",
    operation: "CreateUser",
    region: "us-central1"  # Must match SQL Connect location
  },
  (event) => {
    const variables = event.data.payload.variables;
    const returnedData = event.data.payload.data;
    
    logger.info("User created:", returnedData);
    // Send welcome email, sync to analytics, etc.
  }
);
```

### Basic Trigger (Python)

```python
from firebase_functions import dataconnect_fn, logger

@dataconnect_fn.on_mutation_executed(
  service="myService",
  connector="default",
  operation="CreateUser"
)
def on_user_create(event: dataconnect_fn.Event):
  variables = event.data.payload.variables
  returned_data = event.data.payload.data
  logger.info("User created:", returned_data)
```

### Event Data

```typescript
// event.authType: "app_user" | "unauthenticated" | "admin"
// event.authId: Firebase Auth UID (for app_user)
// event.data.payload.variables: mutation input variables
// event.data.payload.data: mutation response data
// event.data.payload.errors: any errors that occurred
```

### Filtering with Wildcards

```typescript
// Trigger on all User* mutations
export const onUserMutation = onMutationExecuted(
  { operation: "User*" },
  (event) => { /* ... */ }
);

// Capture operation name
export const onAnyMutation = onMutationExecuted(
  { service: "myService", operation: "{operationName}" },
  (event) => {
    console.log("Operation:", event.params.operationName);
  }
);
```

### Use Cases

- **Data sync**: Replicate to Firestore, BigQuery, external APIs
- **Notifications**: Send emails, push notifications on events
- **Async workflows**: Image processing, data aggregation
- **Audit logging**: Track all data changes

> ⚠️ **Avoid infinite loops**: Don't trigger mutations that would fire the same trigger. Use filters to exclude self-triggered events.

---

## Data Seeding & Bulk Operations

### Local Prototyping with `seed_data.gql`

Write seed mutations to `dataconnect/seed_data.gql` (project root, not inside `connector/`).
This file is excluded from SDK generation and production deploys — local emulator only.

```graphql
# dataconnect/seed_data.gql
mutation SeedDemoData @transaction {

  # Insert parent tables before child/join tables (FK order)
  movie_insertMany(data: [
    { id: "m-1", title: "Inception", genre: "sci-fi" },
    { id: "m-2", title: "The Matrix", genre: "action" }
  ])

  actor_insertMany(data: [
    { id: "a-1", name: "Leonardo DiCaprio" },
    { id: "a-2", name: "Keanu Reeves" }
  ])

  # Join table last — parent rows must already exist
  movieActor_insertMany(data: [
    { movieId: "m-1", actorId: "a-1" },
    { movieId: "m-2", actorId: "a-2" }
  ])
}
```

#### Seed data into related tables using nested operations

**To seed related tables atomically, perform a nested relational insert using literal payloads.** This creates the parent record and its associated child records in a single operation without requiring manual foreign key correlation.

**Do not specify the parent foreign key** (e.g., `movieId` in nested reviews) in the nested child payload; it is automatically resolved and assigned.

```graphql
# Nested insert for Movie and Review (1 movie and 2 reviews shown)
mutation SeedNestedDemoData @transaction {
  movie_insert(data: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Inception",
    genre: "sci-fi",
    reviews_on_movie: [
      {
        id: "123e4567-e89b-12d3-a456-426614174002",
        rating: 5,
        reviewText: "Amazing concept!",
        user: { id: "user-uuid-123" }
      },
      {
        id: "123e4567-e89b-12d3-a456-426614174003",
        rating: 4,
        reviewText: "A bit confusing, but great.",
        user: { id: "user-uuid-456" }
      }
    ]
  })
}
```

### Reset Data

**Option A — delete then re-seed** (reverse FK order):

```graphql
mutation ResetDemoData @transaction {
  movieActor_deleteMany(all: true)
  actor_deleteMany(all: true)
  movie_deleteMany(all: true)
  # Then re-run SeedDemoData
}
```

**Option B — upsertMany** (idempotent; re-running seeds and resets in one shot):

```graphql
mutation SeedDemoData @transaction {
  movie_upsertMany(data: [
    { id: "m-1", title: "Inception", genre: "sci-fi" },
    { id: "m-2", title: "The Matrix", genre: "action" }
  ])
}
```

### Production: Admin SDK Bulk Operations

**Use the Admin SDK for bulk data operations on production databases.**

The SDK provides direct methods for working with bulk data. From the provided arguments, each method constructs and executes a GraphQL mutation behind the scenes.

```typescript
import { initializeApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';

const app = initializeApp();
const dc = getDataConnect({ location: "us-central1", serviceId: "my-service" });

// Methods of the bulk operations API
// dc is a Data Connect admin instance from getDataConnect

const data = [
  { id: "m-1", title: "Inception", genre: "sci-fi" },
  { id: "m-2", title: "The Matrix", genre: "action" }
];

const resp1 = await dc.insert("movie" /*table name*/, data[0]);
const resp2 = await dc.insertMany("movie" /*table name*/, data);
const resp3 = await dc.upsert("movie" /*table name*/, data[0]);
const resp4 = await dc.upsertMany("movie" /*table name*/, data);
```

#### Support for Nested Relational Operations (1:Many)

**The specialized bulk APIs natively support nested relational inserts (1:Many relationships).**

Use this approach to atomically insert parent and child records in a single database round-trip without manual foreign key correlation.

```typescript
// Example of inserting a movie with nested reviews
const moviesData = [
  {
    title: "Interstellar",
    genre: "Sci-Fi",
    reviews_on_movie: [
      {
        rating: 5,
        reviewText: "Visually stunning and emotionally powerful.",
        user: { id: "user-789" }
      }
    ]
  }
];

// Atomically insert movies and their reviews in a single database round-trip.
const response = await dc.insertMany("movie", moviesData);
```

### Emulator Data Persistence

```bash
# Export emulator data
npx -y firebase-tools@latest emulators:export ./seed-data

# Start with saved data
npx -y firebase-tools@latest emulators:start --only dataconnect --import=./seed-data
```
