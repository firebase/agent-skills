# Realtime Reference

## Contents
- [When to Use What](#when-to-use-what)
- [The @refresh Directive](#the-refresh-directive)
- [CEL Bindings in Conditions](#cel-bindings-in-conditions)
- [Automatic Entity Refreshes](#automatic-entity-refreshes)

---

## When to Use What

FDC provides three mechanisms for live data updates. Pick the right one based on what you're querying:

| Scenario | Mechanism | Directive Needed? |
|----------|-----------|-------------------|
| Single-entity lookup by ID (e.g., `movie(id: $id)`) | **Automatic refresh** | No — FDC handles it |
| List query that should update when a specific mutation runs | **Event-driven refresh** | `@refresh(onMutationExecuted: ...)` |
| Any query that should poll at a fixed interval | **Time-based polling** | `@refresh(every: ...)` |

List queries require explicit `@refresh` to tell FDC which mutations affect the result set.

Clients consume all three using `subscribe()` instead of `execute()`. See [sdks.md](sdks.md) for per-platform subscribe patterns.

---

## The @refresh Directive

`@refresh` is a **repeatable** directive applied to **queries**. It defines when connected subscribers should receive updated data.

### Time-Based Polling (`every`)

Force the query to re-execute at a regular interval, regardless of mutations.

```graphql
query MovieLeaderboard
  @auth(level: PUBLIC)
  @refresh(every: { seconds: 30 }) {
  movies(orderBy: [{ rating: DESC }], limit: 10) {
    id title rating
  }
}
```

**Constraints:**
- The `every` argument takes a duration object: `{ seconds: Int }`
- **Minimum**: 10 seconds — protects against excessive server load
- **Maximum**: 3600 seconds (1 hour)
- Values outside this range fail validation at deploy time

Use time-based polling when freshness matters but you don't have a specific mutation to listen for (e.g., dashboards aggregating external data, stock tickers, activity feeds).

### Event-Driven Refresh (`onMutationExecuted`)

Trigger a query refresh when a specific mutation executes. This is the most common pattern for keeping lists in sync.

```graphql
# Example with condition (refreshes only when the condition is met)
query ChatRoom($roomId: UUID!) @auth(level: PUBLIC)
  @refresh(onMutationExecuted: {
    operation: "SendMessage",
    condition: "mutation.variables.roomId == request.variables.roomId"
  }) {
  messages(where: {roomId: {eq: $roomId}}, orderBy: [{createTime: DESC}], limit: 50) {
    author content createTime
  }
}

# Example without condition (refreshes on any execution of the named mutation)
query ListAllMessages
  @auth(level: PUBLIC)
  @refresh(onMutationExecuted: {
    operation: "SendMessage"
  }) {
  messages { id content }
}
```

**Arguments:**
- **`operation`** (required): The name of the mutation operation to listen for. Must match the mutation's operation name exactly.
- **`condition`** (optional): A CEL expression that must evaluate to `true` for the refresh to fire. Without a condition, every execution of the named mutation triggers a refresh.

Use conditions to scope refreshes precisely — a review list should only refresh when the mutation targets the same movie, not every review across the entire app.

### Combining Multiple @refresh Directives

Since `@refresh` is repeatable, you can combine strategies on a single query:

```graphql
query ActiveOrders($userId: UUID!)
  @auth(level: USER)
  @refresh(onMutationExecuted: {
    operation: "UpdateOrderStatus",
    condition: "request.variables.userId == mutation.variables.userId"
  })
  @refresh(every: { seconds: 60 }) {
  orders(where: { user: { id: { eq: $userId }}, status: { ne: DELIVERED }}) {
    id status total updatedAt
  }
}
```

This query refreshes whenever an order status changes for this user, *and* polls every 60 seconds as a fallback to catch any updates that might not have a direct mutation trigger.

---

## CEL Bindings in Conditions

The `condition` expression in `onMutationExecuted` has access to two contexts:

### `request` — The Query Subscription
The state of the query being subscribed to.

| Binding | Description |
|---------|-------------|
| `request.variables` | Variables passed to the query (e.g., `request.variables.id`) |
| `request.auth.uid` | UID of the user who subscribed |
| `request.auth.token` | Full auth token claims of the subscriber |

### `mutation` — The Triggering Event
The mutation that just executed.

| Binding | Description |
|---------|-------------|
| `mutation.variables` | Variables passed to the mutation (e.g., `mutation.variables.movieId`) |
| `mutation.auth.uid` | UID of the user who executed the mutation |
| `mutation.auth.token` | Full auth token claims of the mutation executor |

### Common Patterns

```text
# Refresh only when the mutation targets the same entity
"request.variables.id == mutation.variables.id"

# Refresh only when the same user who subscribed makes a change
"request.auth.uid == mutation.auth.uid"

# Refresh when a specific field value matches a condition
"request.auth.uid == mutation.auth.uid && mutation.variables.status == 'PUBLISHED'"

# Refresh when a specific flag is set in the mutation
"mutation.variables.isPublic == true"
```

---

## Automatic Entity Refreshes

For single-entity lookups by unique identifier, FDC handles refreshes automatically — no `@refresh` directive needed.

**What qualifies:**
- Queries fetching one entity by its primary key: `movie(id: $id)`, `user(key: { uid: $uid })`
- If a single-entity mutation modifies that specific entity, all active subscribers automatically receive the update. Supported operations include:
    *   `_insert(data)`
    *   `_upsert(data)`
    *   `_update(id)` or `_update(key)`
    *   `_delete(id)` or `_delete(key)`
- **Note**: Bulk operations like `_updateMany` and `_deleteMany` do **not** trigger automatic entity refreshes.

**What does NOT qualify:**
- List queries: `movies(where: {...})`, `users { id name }` — these require explicit `@refresh`
- Aggregate queries or queries joining multiple entities

```graphql
# When subscribed to, this query auto-refreshes when movie data changes — no @refresh needed
query GetMovie($id: UUID!) @auth(level: PUBLIC) {
  movie(id: $id) {
    id title rating description
    reviews_on_movie { rating text user { displayName } }
  }
}
```

To consume automatic refreshes on the client, use `subscribe()` instead of `execute()` — the same client pattern works regardless of whether the refresh is automatic or directive-driven.
