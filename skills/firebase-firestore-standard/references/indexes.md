# Firestore Standard Edition Indexes Reference

# ⛔️ CRITICAL RULE: FULLY AUTOMATED INDEX MANAGEMENT ⛔️

You **MUST** manage Firestore indexes programmatically. **NEVER** ask the user to manually create indexes in the Firebase Console.

If you write a query requiring a composite index, you **MUST** update `firestore.indexes.json` and deploy it immediately (`npx firebase-tools deploy --only firestore:indexes`).

---

## 0. Automatic vs. Manual Management
### Single-Field Indexes (Automatic)
Firestore **automatically creates** a single-field index for every field in a document (and subfields in maps). 
- **Support**: Simple equality queries (`==`) and single-field range/sort queries (`<`, `<=`, `orderBy`).
- **Merging**: Firestore can merge multiple single-field indexes for equality filters (e.g., `where("state", "==", "CA").where("country", "==", "USA")`).

### Composite Indexes (Manual)
Composite indexes store a sorted mapping of documents based on multiple fields.
- **Support**: Complex queries that filter or sort by **multiple fields**.
- **Action Required**: You **MUST** define these manually in `firestore.indexes.json` or via the CLI.

## 1. Automated Workflow
1. **Identify:** Any query combining an equality filter with an `orderBy` or range filter needs an index.
2. **Append:** Add the index block to `firestore.indexes.json`. Fields in `where` filters MUST come before `orderBy` fields.
3. **Deploy:** `npx -y firebase-tools@latest deploy --only firestore:indexes`.

## 2. Standard Index Template
```json
{
  "collectionGroup": "COLLECTION_NAME",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "FIELD_1", "order": "ASCENDING" },
    { "fieldPath": "FIELD_2", "order": "ASCENDING" }
  ]
}
```

## 3. Query Support (When is a Composite Index Required?)

| Query Type | Index Required |
| :--- | :--- |
| **Equality + Range/Sort**<br>`where("a", "==", 1).where("b", ">", 2)` | **Composite Index** on `a` and `b` |
| **Multiple Ranges**<br>`where("a", ">", 1).where("b", ">", 2)` | **Composite Index** on `a` and `b` |
| **Array Contains + Equality**<br>`where("tags", "array-contains", "x").where("a", "==", true)` | **Composite Index** on `tags` and `a` |

---

## 4. Standard Edition Behavior
Firestore Standard creates single-field indexes by default. If a required composite index is missing, the SDK **will throw an error**. You must capture this error and self-correct by updating the JSON and deploying.
