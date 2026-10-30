# Path Traversal Remediation

Adapted from the
[Gemini CLI Security extension knowledge base](https://github.com/gemini-cli-extensions/security/blob/main/mcp-server/src/knowledge/path_traversal.md)
(Apache-2.0).

## Description

Path traversal occurs when user-supplied data builds a file path without
checking that the result stays inside the intended directory, letting attackers
read or write arbitrary files (e.g. `/etc/passwd`, `.env`, service-account keys
bundled with a Cloud Function). The same flaw applies to **Cloud Storage object
paths** built from user input with the Admin SDK (which bypasses Storage rules):
`bucket.file(\`users/${req.body.path}\`)\`.

## Remediation strategy

1. **Resolve** the path from a fixed safe root and the user input.
1. **Validate** that the resolved path starts with the safe root plus a
   separator.
1. **Reject** anything else. Prefer IDs over paths (map an ID to a filename
   server-side).

## Secure pattern (Node.js)

```typescript
import path from 'node:path';
import fs from 'node:fs/promises';

const SAFE_ROOT = path.resolve('/workspace/uploads');

export async function safeReadFile(userInput: string) {
  const target = path.resolve(SAFE_ROOT, userInput);
  if (!target.startsWith(SAFE_ROOT + path.sep)) {
    throw new Error('Access denied: invalid file path.');
  }
  return fs.readFile(target, 'utf-8');
}
```

## Cloud Storage object paths (Admin SDK)

```javascript
// VULNERABLE: "../otherUser/secret.pdf" or "../../admin/export.csv"
const file = bucket.file(`users/${uid}/${req.body.name}`);
// SECURE
const name = String(req.body.name);
if (!/^[\w.-]{1,200}$/.test(name) || name.includes('..')) throw new HttpsError('invalid-argument', 'bad name');
const file = bucket.file(`users/${uid}/${name}`); // uid from verified token
```

## Vulnerable vs secure

```typescript
// VULNERABLE: path.join does not stop "../../etc/passwd"
return fs.readFile(path.join('/workspace/uploads', userInput), 'utf-8');

// SECURE: resolve + prefix check
const target = path.resolve(SAFE_ROOT, userInput);
if (!target.startsWith(SAFE_ROOT + path.sep)) throw new Error('Path traversal detected');
return fs.readFile(target, 'utf-8');
```
