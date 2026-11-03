# SSRF Remediation

Server-side requests to user-supplied URLs let attackers reach internal
services, including the Google Cloud metadata server (`http://169.254.169.254/`,
`http://metadata.google.internal/`) which can return the runtime service
account's access token - full project compromise for a Cloud Function or App
Hosting backend.

## Strategy

1. Prefer an **allow-list of hosts** (or of exact URL prefixes).
1. If arbitrary URLs are a product requirement (link previews, "import from
   URL"), require `https:`, resolve DNS and reject private/loopback/link-local
   addresses, and disable redirects (or re-validate each hop).
1. Set short timeouts and response size limits.

## Secure pattern (Node.js)

```javascript
import dns from 'node:dns/promises';
import net from 'node:net';

const ALLOWED_HOSTS = new Set(['api.example.com', 'images.example.com']);

function isPrivate(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function safeFetch(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  if (ALLOWED_HOSTS.size && !ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  const addrs = await dns.lookup(url.hostname, { all: true });
  if (addrs.some((a) => isPrivate(a.address))) throw new Error('private address');
  return fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
}
```

DNS rebinding can still bypass resolve-then-fetch; for high-risk features, route
egress through a proxy that enforces the policy, or pin the resolved IP.

## Verify

The PoC should stub `fetch` (or use a local listener) and show that
`http://169.254.169.254/computeMetadata/v1/` and `http://127.0.0.1:PORT/` are
now rejected while an allowed URL still works.
