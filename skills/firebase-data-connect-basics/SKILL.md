---
name: firebase-data-connect
description: Builds and deploys Firebase SQL Connect (aka Firebase Data Connect) backends with PostgreSQL securely. Use when designing schemas with tables and relations, writing authorized queries and mutations, configuring real-time data updates, or generating type-safe SDKs. Use when you need a relational database with Firebase, or when the user mentions SQL Connect or Data Connect.
---

# Firebase SQL Connect

Firebase SQL Connect is a relational database service using Cloud SQL for
PostgreSQL with GraphQL schema, auto-generated queries/mutations, and type-safe
SDKs.

> [!NOTE] **Product Rename**: Firebase Data Connect was renamed to **Firebase
> SQL Connect**. All instructions, references, and examples in this skill
> repository referring to "Data Connect" or "Firebase Data Connect" apply to
> "SQL Connect" and "Firebase SQL Connect" as well.

## Project Structure

```text
dataconnect/
├── dataconnect.yaml      # Service configuration
├── seed_data.gql         # LOCAL ONLY — prototype/test data
├── schema/
│   └── schema.gql        # Data model (types with @table)
└── connector/
    ├── connector.yaml    # Connector config + SDK generation
    ├── queries.gql       # Queries
    └── mutations.gql     # Mutations
```

## Key Tools for Validation

Rely on these two mechanisms to ensure project correctness:

1. **Review GraphQL Schema**: Both user-defined and generated extensions (in
   `.dataconnect/schema/main/`).
1. **Validate Operations**: Run
   `npx -y firebase-tools@latest dataconnect:compile` against the schema.

## Operation Strategies: GraphQL vs. Native SQL

Always default to **Native GraphQL**. **Native SQL lacks type safety** and
bypasses schema-enforced structures. Only use **Native SQL** when the user
explicitly requests it or when the task requires advanced database features.

| Strategy                     | When to use                                                                                                            | Implementation                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Native GraphQL** (Default) | Almost all use cases. Standard CRUD, basic filtering/sorting, simple relational joins. Requires full type safety.      | Auto-generated fields (`movie_insert`, `movies`). Strong typing and schema enforcement.                               |
| **Native SQL** (Advanced)    | PostgreSQL extensions (e.g., PostGIS), window functions (`RANK()`), complex aggregations, or highly tuned sub-queries. | Raw SQL string literals via `_select`, `_execute`, etc. Requires strict positional parameters (`$1`). No type safety. |

## Development Workflow

Follow this strict workflow to build your application. You **must** read the
linked reference files for each step to understand the syntax and available
features.

### 1. Define Data Model (`schema/schema.gql`)

Define your GraphQL types, tables, and relationships (which map to a Postgres
schema).

> **Read [references/schema.md](references/schema.md)** for:
>
> - `@table`, `@col`, `@default`
> - Relationships (`@ref`, one-to-many, many-to-many)
> - Data types (UUID, Vector, JSON, etc.)

### 2. Define Authorized Operations (`connector/queries.gql`, `connector/mutations.gql`)

Write the queries and mutations your client will use, including authorization
logic. SQL Connect is secure by default.

> **Read [references/operations.md](references/operations.md)** for:
>
> - **Queries**: Filtering (`where`), Ordering (`orderBy`), Pagination
>   (`limit`/`offset`).
> - **Mutations**: Create (`_insert`), Update (`_update`), Delete (`_delete`).
> - **Upserts**: Use `_upsert` to "insert or update" records (CRITICAL for user
>   profiles).
> - **Transactions**: Use `@transaction` for multi-step atomic operations. Use
>   `_expr: "response.<prevStep>"` to pass data between steps.
>
> **Read [references/security.md](references/security.md)** for authorization:
>
> - `@auth(level: ...)` for PUBLIC, USER, or NO_ACCESS.
> - `@check` and `@redact` for row-level security and validation.
>
> **Read [references/realtime.md](references/realtime.md)** for real-time
> subscriptions:
>
> - `@refresh` directive for time-based polling and event-driven updates.
> - CEL conditions to scope refresh triggers precisely.
>
> **Read [references/native_sql.md](references/native_sql.md)** for Native SQL
> operations:
>
> - Embedding raw SQL with `_select`, `_selectFirst`, `_execute`
> - Strict rules for positional parameters (`$1`, `$2`), quoting, and CTEs
> - Advanced PostgreSQL features (PostGIS, Window Functions)

### 3. Use type-safe SDK in your apps

Generate type-safe code for your client platform.

Configure SDK generation in `connector.yaml`:

```yaml
connectorId: my-connector
generate:
  javascriptSdk:
    outputDir: "../web-app/src/lib/dataconnect"
    package: "@movie-app/dataconnect"
  kotlinSdk:
    outputDir: "../android-app/app/src/main/kotlin/com/example/dataconnect"
    package: "com.example.dataconnect"
  swiftSdk:
    outputDir: "../ios-app/DataConnect"
```

Generate SDKs:

```bash
npx -y firebase-tools@latest dataconnect:sdk:generate
```

For platform-specific instructions on how to use the generated SDKs, read:

- **Web (TypeScript)**: [references/sdk_web.md](references/sdk_web.md)
- **Android (Kotlin)**: [references/sdk_android.md](references/sdk_android.md)
- **iOS (Swift)**: [references/sdk_ios.md](references/sdk_ios.md)
- **Admin (Node.js)**:
  [references/sdk_admin_node.md](references/sdk_admin_node.md)
- **Flutter (Dart)**: [references/sdk_flutter.md](references/sdk_flutter.md)

______________________________________________________________________

## Feature Capability Map

If you need to implement a specific feature, consult the mapped reference file:

| Feature                         | Reference File                                               | Key Concepts                                       |
| :------------------------------ | :----------------------------------------------------------- | :------------------------------------------------- |
| **Data Modeling**               | [references/schema.md](references/schema.md)                   | `@table`, `@unique`, `@index`, Relations           |
| **Vector Search**               | [references/search.md](references/search.md)                   | `Vector`, `@col(dataType: "vector")`, embeddings   |
| **Full-Text Search**            | [references/search.md](references/search.md)                   | `@searchable`, `movies_search`                     |
| **Upserting Data**              | [references/operations.md](references/operations.md)           | `_upsert` mutations                                |
| **Complex Filters**             | [references/operations.md](references/operations.md)           | `_or`, `_and`, `_not`, `eq`, `contains`            |
| **Transactions**                | [references/operations.md](references/operations.md)           | `@transaction`, `response` binding                 |
| **Environment Config**          | [references/config.md](references/config.md)                   | `dataconnect.yaml`, `connector.yaml`               |
| **Realtime Subscriptions**      | [references/realtime.md](references/realtime.md)               | `@refresh`, `subscribe()`, auto-refresh            |
| **Cloud Functions Integration** | [references/cloud_functions.md](references/cloud_functions.md) | `onMutationExecuted`, triggering events            |
| **Data Seeding & Migrations**   | [references/data_seeding.md](references/data_seeding.md)       | `seed_data.gql`, `_insertMany`, Admin SDK bulk     |
| **Starter Templates**           | [templates.md](templates.md)                                 | CRUD, user-owned resources, many-to-many, SDK init |

______________________________________________________________________

## Deployment & CLI

> **Read [references/config.md](references/config.md)** for deep dive on
> configuration.

Follow these patterns based on your current task:

### How to initialize SQL Connect in a Firebase project

1. Understand the app idea. Ask clarification questions if unclear.
1. Run `npx -y firebase-tools@latest init dataconnect`.
1. Validate that the app template and generated SDK are setup.

### How to build apps using SQL Connect locally

1. Start the emulator:
   `npx -y firebase-tools@latest emulators:start --only dataconnect`.
1. Write schema and operations.
1. Seed local test data into `seed_data.gql`. Read
   [references/data_seeding.md](references/data_seeding.md#local-prototyping-data-seeding).
1. Run `npx -y firebase-tools@latest dataconnect:compile` or
   `npx -y firebase-tools@latest dataconnect:sdk:generate` to validate them.
1. Use the operations in your app and build it.

### How to deploy SQL Connect to Cloud SQL

1. Run `npx -y firebase-tools@latest deploy --only dataconnect`.

## Examples

For complete, working code examples of schemas and operations, see
**[examples.md](examples.md)**.

For ready-to-use starter templates (CRUD, user-owned resources, many-to-many,
YAML configs, SDK init), see **[templates.md](templates.md)**.
