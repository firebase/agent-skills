# Firestore Enterprise Native Mode Indexes Reference

# ⛔️ CRITICAL RULE: FULLY AUTOMATED INDEX MANAGEMENT ⛔️

Firestore Enterprise **does not create any indexes by default**. Without indexes, it performs a full collection scan (slow/expensive). You **MUST** manage all indexes programmatically. **NEVER** ask the user to manually create indexes.

If you write a query that needs to be performant, you **MUST** update `firestore.indexes.json` and deploy it immediately.

---

## 1. Enterprise-Specific Index Schema
When adding indexes for Enterprise Native Mode, you MUST include the edition-specific fields: `"density"` and `"unique"`.

### **Standard Dense Index Template**
```json
{
  "collectionGroup": "COLLECTION_NAME",
  "queryScope": "COLLECTION",
  "density": "DENSE",
  "fields": [
    { "fieldPath": "FIELD_1", "order": "ASCENDING" },
    { "fieldPath": "FIELD_2", "order": "ASCENDING" }
  ]
}
```

### **Sparse Index Template** (Only indexes documents with these fields)
```json
{
  "collectionGroup": "COLLECTION_NAME",
  "queryScope": "COLLECTION",
  "density": "SPARSE_ANY",
  "fields": [
    { "fieldPath": "FIELD_1", "order": "ASCENDING" }
  ]
}
```

### **Unique Index Template** (Enforces unique values)
```json
{
  "collectionGroup": "COLLECTION_NAME",
  "queryScope": "COLLECTION",
  "density": "SPARSE_ANY",
  "unique": true,
  "fields": [
    { "fieldPath": "FIELD_1", "order": "ASCENDING" }
  ]
}
```

## 2. Query Support Matrix

| Query Type | Index Required (Enterprise) |
| :--- | :--- |
| **Simple Equality** | Single-Field Index on `a` |
| **Equality + Range/Sort** | **Composite Index** on `a` and `b` |
| **Multiple Ranges** | **Composite Index** on `a` and `b` |

---

## 3. Enterprise Deployment Lifecycle
1. **Append:** Add the index to `firestore.indexes.json` using the Enterprise-specific schema (Density, Unique).
2. **Deploy:** `npx -y firebase-tools@latest deploy --only firestore:indexes`.
3. **Behavior:** Enterprise Edition **will not** throw an error for missing indexes (it defaults to full scan). You **MUST** ensure an index is present to prevent performance degradation and high costs.
