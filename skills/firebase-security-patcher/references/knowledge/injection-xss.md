# Injection and XSS Remediation

## XSS

Strategy: let the framework escape; if raw HTML is truly required, sanitise with
an allow-list sanitiser; never build URLs/HTML from untrusted input.

```jsx
// VULNERABLE
<div dangerouslySetInnerHTML={{ __html: post.body }} />
// SECURE (plain text)
<div>{post.body}</div>
// SECURE (rich text required)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.body) }} />
```

- Markdown: render with HTML disabled (`react-markdown` default; for `marked`,
  sanitise output with DOMPurify).
- URLs: allow only `http:`/`https:` before using user input in `href`/`src`:
  `const safe = /^https?:\/\//i.test(url) ? url : '#';`
- Vue `v-html`, Svelte `{@html}`, Angular `bypassSecurityTrustHtml`: same rule.
- Stored XSS via Storage: restrict upload `contentType` in `storage.rules` and
  serve user files from the Storage domain, not your Hosting domain.
- Defence in depth: add a Content-Security-Policy header in `firebase.json`
  Hosting `headers` or Next.js `headers()`.

## SQL injection (incl. Data Connect native SQL, Cloud SQL, Postgres)

```javascript
// VULNERABLE
await pool.query(`SELECT * FROM orders WHERE id = '${req.query.id}'`);
// SECURE
await pool.query('SELECT * FROM orders WHERE id = $1', [req.query.id]);
```

In Data Connect, use GraphQL variables in `@query`/`@mutation` definitions
instead of string-built SQL.

## NoSQL injection / dynamic paths

```javascript
// VULNERABLE: user controls collection/field names
db.collection(req.query.col).where(req.query.field, '==', req.query.v);
// SECURE: allow-list
const FIELDS = new Set(['status', 'category']);
if (!FIELDS.has(field)) throw new HttpsError('invalid-argument', 'bad field');
db.collection('products').where(field, '==', String(value));
```

Validate document IDs (`/^[A-Za-z0-9_-]{1,128}$/`) before building paths with
the Admin SDK.

## Command injection

```javascript
// VULNERABLE
exec(`convert ${req.body.file} out.png`);
// SECURE: no shell, argument array, validated input
import { execFile } from 'node:child_process';
if (!/^[\w.-]+$/.test(file)) throw new Error('bad filename');
execFile('convert', [file, 'out.png']);
```

Python: `subprocess.run([...], shell=False)`; never `os.system(f"...")`.

## SSTI

Pass user input as template **data**, never as the template string
(`render_template_string(user_input)` ->
`render_template('x.html', v=user_input)`).

## Open redirect

```javascript
const next = req.query.next;
const safe = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
res.redirect(safe);
```
