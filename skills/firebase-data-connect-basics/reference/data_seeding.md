# Data Seeding & Bulk Operations Reference

Use this reference to populate local development databases for prototyping, execute CI/CD tests, and perform bulk data migrations in production environments.

---

## 1. Local Prototyping: Data Seeding

Local database seeding allows developer agents to test queries, mutations, complex joins, and role-based access control (RBAC) under realistic conditions.

### The `seed_data.gql` Workflow

**Always write prototyping seed mutations to `dataconnect/seed_data.gql`** (located at the project root, not inside `connector/`). This file is excluded from production deployments and client SDK generation.

#### ⚠️ Seeding Directives Rule
**Do not declare `@auth` directives inside `seed_data.gql` mutations.** Since this file runs locally to establish a test state and is not an exposed API connector endpoint, authorization directives are completely unnecessary and should be omitted.

### Seeding Independent Tables (FK Order)

When executing standard bulk insertions (`_insertMany`) across multiple tables, **always insert parent tables before referencing them in child or join tables.**

```graphql
# dataconnect/seed_data.gql
mutation SeedIndependentTables @transaction {
  # Step 1: Seed parent tables
  movie_insertMany(data: [
    { id: "m-1", title: "Inception", genre: "sci-fi" },
    { id: "m-2", title: "The Matrix", genre: "action" }
  ])

  actor_insertMany(data: [
    { id: "a-1", name: "Leonardo DiCaprio" },
    { id: "a-2", name: "Keanu Reeves" }
  ])

  # Step 2: Seed join table (depends on pre-existing parent IDs)
  movieActor_insertMany(data: [
    { movie: { id: "m-1" }, actor: { id: "a-1" }, role: "main" },
    { movie: { id: "m-2" }, actor: { id: "a-2" }, role: "main" }
  ])
}
```

### Seeding Related Tables (Nested Relational Inserts)

**To seed parent-child relationships atomically, perform a nested relational insert using literal payloads.** This avoids the need to manage foreign keys manually.

* **Omit Parent Foreign Keys**: **Do not specify the parent foreign key** (e.g. `movieId`) inside the nested child objects. The database engine automatically maps and resolves them.

```graphql
# dataconnect/seed_data.gql
mutation SeedMoviesAndReviews @transaction {
  movie_insert(data: {
    id: "m-1",
    title: "Inception",
    genre: "sci-fi",
    # Nested reviews are inserted atomically without manual movieId mapping
    reviews_on_movie: [
      {
        id: "r-1",
        rating: 5,
        reviewText: "Mind-bending masterpiece!",
        user: { id: "user-123" } # Links to pre-existing user
      },
      {
        id: "r-2",
        rating: 4,
        reviewText: "Visually stunning but complex.",
        user: { id: "user-456" }
      }
    ]
  })
}
```

### Resetting Seed Data

For continuous testing or CI/CD flows, return the database to a zero state using one of the following strategies:

* **Strategy A: Upsert Many (Idempotent)**: Re-run seeds using `_upsertMany` mutations. This overrides existing records or inserts missing ones in a single step.
* **Strategy B: Delete and Re-Insert**: Call `_deleteMany(all: true)` on your tables in **reverse foreign key order** (child/join tables first, then parent tables) followed by your seed `_insertMany` operations.

```graphql
# dataconnect/seed_data.gql
mutation ResetDatabaseToOriginalState @transaction {
  # Delete child tables first to prevent FK constraint violations
  movieActor_deleteMany(all: true)
  actor_deleteMany(all: true)
  movie_deleteMany(all: true)
  # (Optional) Follow up with new _insertMany steps
}
```

---

## 2. Production: Admin SDK Bulk Operations

**Use the Firebase Admin SDK for Node.js for bulk data loading and production migrations.** Avoid running large mutations directly via raw GraphQL endpoints in production.

The Admin SDK provides direct, type-safe methods: `dc.insert`, `dc.insertMany`, `dc.upsert`, and `dc.upsertMany`. 

### SDK Bulk APIs Features:
* **No Manual GraphQL Strings**: Do not write raw `mutation {...}` strings when executing privileged batch operations. Pass Javascript objects directly.
* **Relational Support**: The bulk helper methods natively support nested 1:Many relationships inside the input arrays.

### SDK Bulk Operations Example

```typescript
import { initializeApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';

const app = initializeApp();
const dc = getDataConnect({ location: "us-west2", serviceId: "my-service" });

const bulkMoviesData = [
  {
    id: "m-1",
    title: "Inception",
    genre: "sci-fi",
    // Atomic nested relational inserts are fully supported
    reviews_on_movie: [
      {
        rating: 5,
        reviewText: "Incredible concept.",
        user: { id: "user-123" }
      }
    ]
  },
  {
    id: "m-2",
    title: "The Matrix",
    genre: "action",
    reviews_on_movie: [
      {
        rating: 5,
        reviewText: "A classic.",
        user: { id: "user-456" }
      }
    ]
  }
];

// Atomically load thousands of records (parent and child tables combined)
const response = await dc.insertMany("movie", bulkMoviesData);
```

---

## 3. Production: Bulk Operations via raw SQL

When working with a stable schema in production, you can use standard SQL tools (like `psql` or Cloud SQL import pipelines) to execute bulk data updates directly on the PostgreSQL instance.

### 🚨 Critical SQL Operations Constraint
**Never modify your database schema directly using SQL tools.** Direct schema alterations (`ALTER TABLE`, `CREATE INDEX`, etc.) outside of your `schema.gql` file will bypass SQL Connect's schema compiler, breaking connector mappings, and causing active client SDK integrations to fail.
