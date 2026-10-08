# Secrets Remediation

## Strategy

1. **Remove** the secret from code/config and from anything shipped to clients.
1. **Store** it in a secret manager and read it only on the server.
1. **Rotate** it - assume any secret that was ever committed, pushed, bundled or
   deployed is compromised. Removing it from the latest commit is not enough;
   git history and deployed bundles keep it.
1. **Restrict** what remains public (API key restrictions, App Check).

## Where secrets should live

| Runtime              | Use                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cloud Functions (v2) | `defineSecret('STRIPE_KEY')` + `onRequest({ secrets: [stripeKey] }, ...)`; set with `firebase functions:secrets:set STRIPE_KEY`   |
| App Hosting          | `apphosting.yaml` -> `env: - variable: STRIPE_KEY` / `secret: stripeKey`; create with `firebase apphosting:secrets:set stripeKey` |
| Local dev            | `.env.local` / `functions/.secret.local`, listed in `.gitignore`                                                                  |
| Client               | Nothing secret. Only the Firebase web config and publishable keys                                                                 |

```javascript
// Cloud Functions v2
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
const stripeKey = defineSecret('STRIPE_KEY');
export const checkout = onRequest({ secrets: [stripeKey] }, async (req, res) => {
  const stripe = new Stripe(stripeKey.value());
  // ...
});
```

```yaml
# apphosting.yaml
env:
  - variable: STRIPE_SECRET_KEY
    secret: stripeSecretKey     # NOT value: sk_live_...
    availability:
      - RUNTIME                 # never BUILD for secrets read by client code
```

## Client-exposed secrets

- Rename `NEXT_PUBLIC_*`/`VITE_*` secret variables to server-only names and move
  the code that uses them into a server route, Server Action, or Cloud Function.
- For AI calls from the client, switch from the Gemini Developer API key to
  **Firebase AI Logic** (calls are proxied and can be protected by App Check),
  or call your own authenticated server endpoint.

## Committed files

- Service-account JSON: delete the file, revoke the key in Google Cloud Console
  (IAM -> Service Accounts -> Keys), and use Application Default Credentials on
  Firebase/Google Cloud runtimes (`initializeApp()` with no arguments).
- `.env` files: remove from git (`git rm --cached .env`), add to `.gitignore`,
  rotate every value.
- History rewrite (e.g. `git filter-repo`) is optional and destructive; only
  suggest it, never run it without explicit user approval. Rotation is mandatory
  regardless.

## Not secrets (do not "fix")

Firebase web `apiKey`, `google-services.json`, `GoogleService-Info.plist`,
`firebase_options.dart`. Optionally recommend
[API key restrictions](https://firebase.google.com/docs/projects/api-keys).
