# Security Rules Remediation (Firestore, Storage, RTDB)

## Strategy

1. **Default deny** at the root; open only the paths the app uses.
1. **Ownership from the verified token**: compare `request.auth.uid` to the path
   variable or `resource.data.ownerId` - never to client-supplied data alone.
1. **Authority from custom claims** (`request.auth.token.admin == true`), set
   only by trusted server code, or from a server-written roles collection that
   clients cannot write.
1. **Validate on create AND update** via a shared validator function; lock
   immutable fields (`ownerId`, `createdAt`, `role`).
1. **Bound sizes and types** (`is string`, `.size() <= N`, `hasOnly([...])`).
1. Keep client queries working: if you add an ownership condition on `list`, the
   client query must filter on the same field.

## Firestore secure pattern

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }
    function isAdmin() { return signedIn() && request.auth.token.admin == true; }

    function validProfile(d) {
      return d.keys().hasOnly(['displayName', 'email', 'photoURL', 'role', 'createdAt'])
        && d.displayName is string && d.displayName.size() <= 100
        && d.email == request.auth.token.email;
    }

    match /users/{userId} {
      allow get: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId) && validProfile(request.resource.data)
        && request.resource.data.role == 'user';
      allow update: if isOwner(userId) && validProfile(request.resource.data)
        && request.resource.data.role == resource.data.role          // immutable
        && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if isAdmin();
    }

    // Public content: read-only for everyone, writes for admins only.
    match /posts/{postId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

## Vulnerable vs secure

| Vulnerable                                                                     | Secure                                  |
| ------------------------------------------------------------------------------ | --------------------------------------- |
| `allow read, write: if true;`                                                  | Per-collection rules as above           |
| `allow read, write: if request.time < timestamp.date(2026, 11, 1);`            | Remove test-mode block entirely         |
| `allow read, write: if request.auth != null;`                                  | `if isOwner(userId)` / membership check |
| `allow update: if request.resource.data.role == 'admin'`                       | `request.auth.token.admin == true`      |
| `match /{document=**} { allow read: if signedIn(); }` alongside specific rules | Delete the catch-all (rules are OR'd)   |

## Storage secure pattern

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{fileName} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(png|jpeg|webp)');
    }
  }
}
```

## Realtime Database secure pattern

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['name']) && newData.child('name').isString() && newData.child('name').val().length <= 100"
      }
    }
  }
}
```

## Verify

Re-run the emulator PoC (`firebase-security-poc`, `references/rules-poc.md`):
attack must now fail, owner access must still succeed. Validate with the
Firebase MCP `firebase_validate_security_rules` tool if available. Deploy with
`firebase deploy --only firestore:rules` (or `storage`, `database`) - the user
runs this, not the agent.
