# SAST Vulnerability Checklist

Generic vulnerability knowledge base, adapted from the
[Gemini CLI Security extension](https://github.com/gemini-cli-extensions/security/blob/main/GEMINI.md)
(Apache-2.0). Check every in-scope file against every section. Firebase-specific
checks live in [firebase-checklist.md](firebase-checklist.md).

## 1. Hardcoded secrets

- Flag variables/strings that match API keys (`API_KEY`, `_SECRET`, `sk_live_`,
  `sk-`, `AKIA`, `ghp_`, `xox[bp]-`), passwords, private keys
  (`-----BEGIN ... PRIVATE KEY-----`), connection strings with credentials, JWT
  signing secrets, and symmetric encryption keys.
- Decode newly introduced base64 strings and check for credentials.
- Severity rises sharply if the secret is in **client-shipped code** (anything
  bundled for the browser or a mobile app) or committed to git.

```javascript
// VULNERABLE
const stripe = new Stripe("sk_live_123abc456def789ghi");
```

## 2. Broken access control

- **IDOR**: endpoints/functions that load a resource by a user-supplied ID
  without checking the caller owns it.

  ```python
  # INSECURE
  def get_order(order_id, current_user):
      return db.orders.find_one({"_id": order_id})
  # SECURE
  def get_order(order_id, current_user):
      order = db.orders.find_one({"_id": order_id})
      if order.user_id != current_user.id:
          raise AuthorizationError()
      return order
  ```

- **Missing function-level access control**: privileged handlers without an
  `isAdmin`/permission check.

- **Privilege escalation / mass assignment**: request bodies copied wholesale
  into stored records (`{...req.body}`), letting users set `role`, `isAdmin`,
  `credits`, `ownerId`, `plan`.

- **Path traversal / LFI**: user input in file paths without
  resolve-and-prefix-check.

- **Open redirect**: `res.redirect(req.query.next)` without allow-list.

- **CORS**: `Access-Control-Allow-Origin: *` (or reflected origin) together with
  credentials or cookie auth.

## 3. Insecure data handling

- **Weak crypto**: DES/3DES/RC4/ECB, MD5/SHA1 for passwords or signatures, RSA
  \< 2048, `Math.random()` for tokens.
- **Sensitive data in logs**: passwords, tokens, PII, full request bodies.
- **PII handling**: unencrypted storage, HTTP transport, PII in URLs.
- **Insecure deserialization**: `pickle.loads`, `yaml.load` (unsafe loader),
  `node-serialize`, Java `ObjectInputStream` on untrusted data.

## 4. Injection

- **SQL injection**: string-built queries. Only parameterised queries / safe ORM
  methods are acceptable. Includes Data Connect `@query(sql:)` / native SQL
  built from variables.
- **NoSQL injection**: user objects passed as query operators (Mongo `$where`,
  `$ne`), or user-controlled field paths/collection names in Firestore queries.
- **XSS**: unsanitised input rendered as HTML - `dangerouslySetInnerHTML`,
  `innerHTML`, `v-html`, `{@html}`, `bypassSecurityTrustHtml`, markdown
  renderers with HTML enabled, `href={userUrl}` allowing `javascript:`.
- **Command injection**: `child_process.exec`, `os.system`,
  `subprocess(..., shell=True)` with user input.
- **SSRF**: server-side `fetch(userUrl)` without allow-list (watch for "import
  from URL", webhooks, link previews, image proxies; metadata server
  `169.254.169.254` / `metadata.google.internal`).
- **SSTI**: user input embedded in server-side templates before rendering.

## 5. Authentication

- **Auth bypass**: trusting client-sent `uid`/`email`, decoding a JWT without
  verifying it, skipping `verifyIdToken`, custom login endpoints without
  brute-force protection/rate limits.
- **Weak session tokens**: predictable, low-entropy, or derived from user data.
- **Insecure password reset**: predictable tokens, tokens in logs/URLs, no
  expiry, user enumeration.

## 6. LLM safety

- **Prompt injection**: untrusted input concatenated into prompts (especially
  system prompts or tool-enabled agents) without separation; secrets/PII inside
  prompts.
- **Improper output handling**: LLM output passed to `eval`/shell/SQL/HTML
  sinks, or used for security decisions (authz) without validation.
- **Insecure tool use**: tools granting file-system writes, shell, unrestricted
  network, or Admin-SDK database access to a model that reads untrusted content.
- **Cost/abuse**: AI endpoints callable without auth, App Check, or rate limits
  (denial-of-wallet).

## 7. Privacy violations

Trace **privacy sources** (`email`, `password`, `ssn`, `firstName`, `lastName`,
`address`, `phone`, `dob`, `creditCard`, `apiKey`, `token`, location, health
data) to **privacy sinks**:

- Logging (`console.log`, `logger.info`, `functions.logger`, Crashlytics custom
  keys).
- Third-party SDKs (analytics, marketing, LLM APIs) without masking or a
  legitimate basis.

```javascript
// INSECURE
analytics.track("User Signed Up", { email: user.email, fullName: user.name });
```

## 8. Availability and abuse (report only with concrete evidence)

- Unbounded reads (`getDocs(collection(...))` with no `limit()` on
  user-controlled paths), unbounded uploads, regex DoS on user input, missing
  rate limits on expensive endpoints (email/SMS send, AI calls, payments).
