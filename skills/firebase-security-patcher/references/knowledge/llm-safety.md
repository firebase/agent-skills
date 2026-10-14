# LLM / AI Feature Remediation

Applies to Firebase AI Logic, Genkit, and direct Gemini/OpenAI/Anthropic SDK
use.

## Exposed model API keys / unauthenticated AI endpoints

- Client code must not hold a model provider key. Use
  [Firebase AI Logic](https://firebase.google.com/docs/ai-logic) from the client
  (requests are proxied; enable
  [App Check](https://firebase.google.com/docs/ai-logic/app-check)), or call a
  server endpoint.
- Server endpoints that call models must require auth and App Check and apply a
  per-user quota (denial-of-wallet).

```javascript
// Genkit flow exposed as a callable function
import { onCallGenkit } from 'firebase-functions/https';
export const summarize = onCallGenkit(
  {
    secrets: [geminiApiKey],
    enforceAppCheck: true,
    authPolicy: (auth) => !!auth?.token?.email_verified,
  },
  summarizeFlow,
);
```

## Prompt injection

- Keep instructions in the system prompt; pass untrusted content as clearly
  delimited data and tell the model to treat it as data.
- **Minimise tool power**: tools available to a model that reads untrusted input
  (user docs, emails, web pages, uploads) must not perform privileged actions
  (Admin-SDK writes, deletes, sending email, payments) without a deterministic
  authorization check in the tool code using the **end user's** identity, not
  the server's.
- Never put secrets or other users' PII in prompts.

```javascript
// Tool implementation enforces authZ itself - never trusts the model's args.
const getOrder = ai.defineTool({ name: 'getOrder', inputSchema: z.object({ orderId: z.string() }) },
  async ({ orderId }, { context }) => {
    const order = (await db.doc(`orders/${orderId}`).get()).data();
    if (!order || order.ownerId !== context.auth?.uid) throw new Error('Not found');
    return { status: order.status };
  });
```

## Unsafe output handling

- Treat model output as untrusted input: escape before rendering (see
  [injection-xss.md](injection-xss.md)), never `eval`/`exec` it, never build
  SQL/paths/URLs from it without validation.
- Prefer structured output (`output: { schema: z.object(...) }`) and validate it
  with the schema before use.
- Do not make authorization decisions based on model output.
