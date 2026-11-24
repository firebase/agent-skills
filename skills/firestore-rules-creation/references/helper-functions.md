# Firestore Rules Helper Functions

Reference for the `firestore-rules-creation` skill. Copy these helper functions
into the `firestore.rules` file you generate, adapt them to the application's
data model, and add domain validators (like `isValidUser`) for each collection.

```javascript
// ===============================================================
// Helper Functions
// ===============================================================
//
// Check if the user is authenticated
function isAuthenticated() {
   return request.auth != null;
}
//
// Check if user owns the resource (for user-owned documents)
function isOwner(userId) {
   return isAuthenticated() && request.auth.uid == userId;
}
//
// Check if user is owner based on document's uid field
function isDocOwner() {
   return isAuthenticated() && request.auth.uid == resource.data.uid;
}
//
// Verify UID hasn't been tampered with on create
function uidUnchanged() {
   return !('uid' in request.resource.data) ||
     request.resource.data.uid == request.auth.uid;
}
//
// Ensure uid field is not modified on update
function uidNotModified() {
   return !('uid' in request.resource.data) ||
     request.resource.data.uid == resource.data.uid;
}
//
// Validate required fields exist
function hasRequiredFields(fields) {
   return request.resource.data.keys().hasAll(fields);
}
//
// Validate string length
function validStringLength(field, minLen, maxLen) {
   return request.resource.data[field] is string &&
     request.resource.data[field].size() >= minLen &&
     request.resource.data[field].size() <= maxLen;
}
//
// Validate URL format (must start with https:// or http://)
function isValidUrl(url) {
   return url is string &&
     (url.matches("^https://.*") || url.matches("^http://.*"));
}
//
// Validate email format
function isValidEmail(email) {
   return email is string &&
     email.matches("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
}

//
// Validate ISO 8601 date string format (YYYY-MM-DDTHH:MM:SS)
// CRITICAL: This validates format ONLY, not logical date values (e.g., month 13).
// Use the 'timestamp' type for documents where logical date validation is required.
function isValidDateString(dateStr) {
  return dateStr is string &&
    dateStr.matches("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.*Z?$");
}

//
// Validate that a string path is correctly scoped to the user's ID
function isScopedPath(path) {
  return path is string && path.matches("^users/" + request.auth.uid + "/.*");
}
//
// Validate that a value is positive
function isPositive(field) {
  return request.resource.data[field] is number && request.resource.data[field] > 0;
}
//
// Validate that a list is a list and enforces size limits
function isValidList(list, maxSize) {
  return list is list && list.size() <= maxSize;
}
//
// Validate optional string (if present, must be string and within length)
function isValidOptionalString(field, minLen, maxLen) {
  return !(field in request.resource.data) ||
         (request.resource.data[field] is string &&
          request.resource.data[field].size() >= minLen &&
          request.resource.data[field].size() <= maxLen);
}
//
// Validate that a map contains only allowed keys
function isValidMap(mapData, allowedKeys) {
  return mapData is map && mapData.keys().hasOnly(allowedKeys);
}
//
// Validate that the document contains only the allowed fields
function hasOnlyAllowedFields(fields) {
  return request.resource.data.keys().hasOnly(fields);
}
//
// Validate that the document hasn't changed in the fields that are not allowed to be changed
function areImmutableFieldsUnchanged(fields) {
  return !request.resource.data.diff(resource.data).affectedKeys().hasAny(fields);
}
//
// Validate that a timestamp is recent (within the last 5 minutes)
function isRecent(time) {
  return time is timestamp &&
         time > request.time - duration.value(5, 'm') &&
         time <= request.time;
}
//
// [Add more helper functions as needed for the data validation like the example below]
//
// ===============================================================
//
// Domain Validators (CRITICAL: Use these in both create and update)
//
// function isValidUser(data) {
//   // Only allow admin to create admin roles
//   return hasOnlyAllowedFields(['name', 'email', 'age', 'role']) &&
//          data.name is string && data.name.size() > 0 && data.name.size() < 50 &&
//          data.email is string && isValidEmail(data.email) &&
//          data.age is number && data.age >= 18 &&
//          data.role in ['admin', 'user', 'guest'];
// }
```
