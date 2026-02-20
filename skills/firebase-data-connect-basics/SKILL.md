---
name: firebase-data-connect
description: Build and deploy Firebase Data Connect backends with PostgreSQL. Use for schema design, GraphQL queries/mutations, authorization, and SDK generation for web, Android, iOS, and Flutter apps.
---

# Firebase Data Connect

Firebase Data Connect is a relational database service using Cloud SQL for PostgreSQL with GraphQL schema, auto-generated queries/mutations, and type-safe SDKs.

## Project Structure

```
dataconnect/
├── dataconnect.yaml      # Service configuration
├── schema/
│   └── schema.gql        # Data model (types with @table)
└── connector/
    ├── connector.yaml    # Connector config + SDK generation
    ├── queries.gql       # Queries
    └── mutations.gql     # Mutations
```

## Development Workflow

Follow this strict workflow to build your application. You **must** read the linked reference files for each step to understand the syntax and available features.

### 1. Define Data Model (`schema/schema.gql`)
Define your GraphQL types, tables, and relationships.
> **Read [reference/schema.md](reference/schema.md)** for:
> *   `@table`, `@col`, `@default`
> *   Relationships (`@ref`, one-to-many, many-to-many)
> *   Data types (UUID, Vector, JSON, etc.)

### 2. Define Operations (`connector/queries.gql`, `connector/mutations.gql`)
Write the queries and mutations your client will use. Data Connect generates the underlying SQL.
> **Read [reference/operations.md](reference/operations.md)** for:
> *   **Queries**: Filtering (`where`), Ordering (`orderBy`), Pagination (`limit`/`offset`).
> *   **Mutations**: Create (`_insert`), Update (`_update`), Delete (`_delete`).
> *   **Upserts**: Use `_upsert` to "insert or update" records (CRITICAL for user profiles).
> *   **Transactions**: use `@transaction` for multi-step atomic operations.

### 3. Secure Your App (`connector/` files)
Add authorization logic closely with your operations.
> **Read [reference/security.md](reference/security.md)** for:
> *   `@auth(level: ...)` for PUBLIC, USER, or NO_ACCESS.
> *   `@check` and `@redact` for row-level security and validation.

### 4. Generate & Use SDKs
Generate type-safe code for your client platform.
> **Read [reference/sdks.md](reference/sdks.md)** for:
> *   Android (Kotlin), iOS (Swift), Web (TypeScript), Flutter (Dart).
> *   How to initialize and call your queries/mutations.
> *   **Nested Data**: See how to access related fields (e.g., `movie.reviews`).

---

## Feature Capability Map

If you need to implement a specific feature, consult the mapped reference file:

| Feature | Reference File | Key Concepts |
| :--- | :--- | :--- |
| **Data Modeling** | [reference/schema.md](reference/schema.md) | `@table`, `@unique`, `@index`, Relations |
| **Vector Search** | [reference/advanced.md](reference/advanced.md) | `Vector`, `@col(dataType: "vector")` |
| **Full-Text Search** | [reference/advanced.md](reference/advanced.md) | `@searchable` |
| **Upserting Data** | [reference/operations.md](reference/operations.md) | `_upsert` mutations |
| **Complex Filters** | [reference/operations.md](reference/operations.md) | `_or`, `_and`, `_not`, `eq`, `contains` |
| **Transactions** | [reference/operations.md](reference/operations.md) | `@transaction`, `response` binding |
| **Environment Config** | [reference/config.md](reference/config.md) | `dataconnect.yaml`, `connector.yaml` |

---

## Deployment & CLI

> **Read [reference/config.md](reference/config.md)** for deep dive on configuration.

Common commands (run from project root):

```bash
# Initialize Data Connect
firebase init dataconnect

# Start local emulator
firebase emulators:start --only dataconnect

# Generate SDK code
firebase dataconnect:sdk:generate

# Deploy to production
firebase deploy --only dataconnect
```

## Examples

For complete, working code examples of schemas and operations, see **[examples.md](examples.md)**.
