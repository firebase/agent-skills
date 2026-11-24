# Advanced Validation for Business Logic: Patterns and Examples

Reference for the `firestore-rules-creation` skill. Secure rules must enforce
the application's business logic. Each pattern below includes the full
requirements and an example.

#### 1. Enforce Enum Values

If a field should only contain specific values (e.g., a status), validate
against a list.

**Example:**

```javascript
 // A 'task' document's status can only be one of three values
 function isValidStatus() {
   let validStatuses = ['pending', 'in-progress', 'completed'];
   return request.resource.data.status in validStatuses;
 }

 allow create: if isValidStatus() && ...
```

#### 2. Validate State Transitions

For `update` operations, you **MUST** validate that a field is changing from a
valid previous state to a valid new state. This prevents users from bypassing
workflows (e.g., marking a task as 'completed' from 'archived').

**Example:**

```javascript
 // A task can only be marked 'completed' if it was 'in-progress'
 function validStatusTransition() {
   let previousStatus = resource.data.status;
   let newStatus = request.resource.data.status;

   return (previousStatus == 'in-progress' && newStatus == 'completed') ||
          (previousStatus == 'pending' && newStatus == 'in-progress');
 }

 allow update: if validStatusTransition() && ...
```

#### 3. Strict Path and Relationship Scoping

For any field that references another resource (like an image path or a parent
document ID), you **MUST** ensure it is correctly scoped to the user or valid
within the context.

**Example:**

```javascript
// Ensure image path is within the user's own storage folder
allow create: if isScopedPath(request.resource.data.imageBucket) && ...
```

#### 4. Secure Counter Updates

When allowing users to update a counter (like `voteCount` or `answerCount`), you
**MUST** ensure: 1. **Atomic Increments:** The field is only changing by exactly
+1 or -1. 2. **Isolation:** **NO OTHER FIELDS** are being modified. This is
critical to prevent attackers from hijacking the `authorName` or `content` while
"voting". 3. **Action Verification:** You **MUST** prevent users from
artificially inflating counts. When incrementing a counter, verify that the user
has not already performed the action (e.g., by checking for the existence of a
'like' document) and is not looping updates. * **CRITICAL:** Relying solely on
`!exists(likeDoc)` is insufficient because a malicious user can skip creating
the document and loop the increment. * **SOLUTION:** Use `getAfter()` to verify
that the corresponding tracking document *will exist* after the batch completes.

**Example:**

```javascript
function isValidCounterUpdate(docId) {
  // Allow update only if 'voteCount' is the ONLY field changing
  return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['voteCount']) &&
         // And the change is exactly +1 or -1
         math.abs(request.resource.data.voteCount - resource.data.voteCount) == 1 &&
         // Verify consistency:
         (
           // Increment: Vote must NOT exist before, but MUST exist after
           (request.resource.data.voteCount > resource.data.voteCount &&
            !exists(/databases/$(database)/documents/votes/$(request.auth.uid + '_' + docId)) &&
            getAfter(/databases/$(database)/documents/votes/$(request.auth.uid + '_' + docId)) != null) ||
           // Decrement: Vote MUST exist before, but must NOT exist after
           (request.resource.data.voteCount < resource.data.voteCount &&
            exists(/databases/$(database)/documents/votes/$(request.auth.uid + '_' + docId)) &&
            getAfter(/databases/$(database)/documents/votes/$(request.auth.uid + '_' + docId)) == null)
         );
}

allow update: if isValidCounterUpdate(docId) && ...
```
