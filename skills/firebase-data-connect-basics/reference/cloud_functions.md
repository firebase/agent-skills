# Cloud Functions Integration Reference

Use this reference to handle database events in SQL Connect by triggering Cloud
Functions in response to mutation executions.

______________________________________________________________________

## Core Trigger Configuration

To handle a mutation execution, define the `onMutationExecuted` event handler.

### 🚨 Critical Infinite Loop Constraint

Unlike document-based database triggers (like Firestore or Realtime Database),
**SQL Connect event triggers do not provide a "before" snapshot of the data.**
Because SQL Connect proxies requests directly to PostgreSQL, "before" states
cannot be resolved transactionally.

- **Warning**: If `onMutationExecuted` executes a SQL Connect mutation, it can
  trigger another `onMutationExecuted` trigger in a cascading loop. Make sure
  that `onMutationExecuted` has a filter on `operation` to reduce the chance of
  infinite loops.
- **Rule**: Ensure that no mutation executed inside the function can ever
  trigger the handler itself, even indirectly.

### Location & Region Matching Rule

**The Cloud Function region option must match your SQL Connect service
location.** You **must** explicitly configure the `region` parameter (e.g.,
`'us-central1'`) in the trigger options to match the `location` specified in
`dataconnect.yaml`.

```typescript
import { onMutationExecuted } from "firebase-functions/dataconnect";
import { logger } from "firebase-functions";

export const logMutation = onMutationExecuted(
  {
    region: "europe-west1" // Must match the SQL Connect service location
  },
  (event) => {
    logger.info("A mutation was executed!", {
      eventId: event.id,
      type: event.type
    });
  }
);
```

______________________________________________________________________

## Event Filtering

To prevent unnecessary function invocations and infinite execution loops,
**always specify narrow filters** using `service` and `operation` attributes.

- **`service` & `operation` (Recommended)**: Always specify these to restrict
  the trigger to a specific mutation in your project.
- **`connector` (Optional)**: Can be omitted if you want to trigger on the same
  operation name across multiple connectors. Specify it only if you need to
  restrict the trigger to a specific connector.

### Comprehensive Example

```typescript
import { onMutationExecuted } from "firebase-functions/dataconnect";
import { logger } from "firebase-functions";

// Triggers for "CreateUser" mutation in "myAppService" service.
// 'connector' is omitted (optional), meaning it matches "CreateUser" in any connector.
export const onUserCreate = onMutationExecuted(
  {
    service: "myAppService",
    operation: "CreateUser",
    // region: "us-central1" // Optional: defaults to us-central1, change if database is elsewhere
  },
  (event) => {
    logger.info("A new user was created!");
  }
);

// Advanced: Trigger using wildcards or capture variables
export const onMutationCaptures = onMutationExecuted(
  {
    service: "myAppService",
    operation: "{operation}", // Captures matching operation name dynamically
  },
  (event) => {
    const triggeredOp = event.params.operation;
    logger.info(`Captured operation execution: ${triggeredOp}`);
  }
);
```

______________________________________________________________________

## Accessing User Authentication Context

Extract security credentials about the caller who executed the mutation using
`event.authType` and `event.authId`.

### Auth Context Mappings

| Triggered Principal                  | `event.authType`    | `event.authId`                                   |
| :----------------------------------- | :------------------ | :----------------------------------------------- |
| **Authenticated end user**           | `"app_user"`        | Firebase Auth token UID                          |
| **Unauthenticated end user**         | `"unauthenticated"` | Empty                                            |
| **Admin SDK (Impersonating User)**   | `"app_user"`        | Firebase Auth token UID of the impersonated user |
| **Admin SDK (Impersonating Unauth)** | `"unauthenticated"` | Empty                                            |
| **Admin SDK (Full privileges)**      | `"admin"`           | Empty                                            |

### Auth Extraction Example

```typescript
export const processSensitiveMutation = onMutationExecuted(
  { operation: "UpdateFinancials" },
  (event) => {
    if (event.authType === "admin") {
      console.log("Elevated admin mutation execution.");
    } else {
      console.log(`Mutation initiated by user: ${event.authId}`);
    }
  }
);
```

______________________________________________________________________

## Parsing Event Data Payloads

The trigger payload provides inputs passed to the mutation (`payload.variables`)
and return values generated from the execution (`payload.data`).

### Event Payload Structure

```json
{
  "authType": "app_user",
  "authId": "user-123",
  "data": {
    "payload": {
      "variables": {
        "movieId": "m-1",
        "rating": 5
      },
      "data": {
        "review_insert": {
          "id": "r-99"
        }
      },
      "errors": []
    }
  }
}
```

- **`event.data.payload.variables`**: Inputs passed to the mutation.
- **`event.data.payload.data`**: Fields returned by the mutation execution.
- **`event.data.payload.errors`**: Array of execution errors. Empty if
  successful.

### Payload Extraction Example

```typescript
import { onMutationExecuted } from "firebase-functions/dataconnect";
import { logger } from "firebase-functions";

export const onNewReview = onMutationExecuted(
  {
    service: "myAppService",
    connector: "reviews",
    operation: "CreateReview",
  },
  (event) => {
    // Extract input variables passed to the mutation
    const inputVariables = event.data.payload.variables;

    // Extract returned fields from the database write
    const returnedFields = event.data.payload.data;

    logger.info(`Processed review ${returnedFields.review_insert.id} for movie ${inputVariables.movieId}`);
  }
);
```
