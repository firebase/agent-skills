# Taint Analysis and the Two-Pass Workflow

Adapted from the `/security:analyze` command of the
[Gemini CLI Security extension](https://github.com/gemini-cli-extensions/security/blob/main/commands/security/analyze.toml)
(Apache-2.0).

The core technique: trace untrusted or sensitive data from its entry point
(**Source**) to where it is executed, rendered, stored, or sent (**Sink**). A
vulnerability exists when nothing on the path sanitises, validates, escapes, or
authorises it. For PII, "sanitisation" means masking/redaction before a log or
third-party sink.

## Firebase sources and sinks

| Sources (untrusted)                                                        | Sinks (dangerous)                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `req.body`, `req.query`, `req.params`, headers, cookies                    | Admin SDK writes/reads (`db.doc(path)`, `collection(userInput)`) - bypass rules |
| `request.data` in `onCall` (but **not** `request.auth`, which is verified) | HTML: `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, markdown-to-HTML        |
| Server Action / route handler arguments, `searchParams`                    | `exec`, `spawn`, `eval`, `new Function`, `vm`                                   |
| Firestore/RTDB documents writable by other users                           | `fetch`/`axios` to a user-supplied URL (SSRF)                                   |
| Storage uploads (name, contentType, content)                               | File system paths (`fs.readFile`, `path.join`)                                  |
| URL/hash params, `postMessage`, deep links in mobile apps                  | SQL / Data Connect native SQL strings                                           |
| LLM output, tool-call arguments                                            | `setCustomUserClaims`, role/plan fields                                         |
| Webhook payloads                                                           | Logs, analytics, Crashlytics keys, LLM prompts (privacy sinks)                  |
| `.env`/Remote Config values exposed to clients                             | `res.redirect`, `window.location`                                               |

## Recon pass (per file)

Goal: complete coverage, no deep dives.

1. Read the whole file once against both checklists.
1. Every time you see a Source, add an indented sub-task under the current Recon
   task in `SECURITY_ANALYSIS_TODO.md`:
   `- [ ] Investigate data flow from <variable> on line <n>`.
1. Also add sub-tasks for non-taint suspicions (hardcoded secret, permissive
   rule, missing auth check on an exported handler, AI key in client).
1. Continue to the end of the file, then mark the Recon task `[x]`.

## Investigate pass (per sub-task)

1. Start at the variable/line. Follow it through assignments, function calls
   (open the callee file if needed), object properties and async boundaries.
1. Find the Sink(s) it reaches.
1. Check the path for: authentication (`verifyIdToken`, `request.auth`),
   authorisation (ownership check against the verified uid), validation
   (schema/zod/type checks), escaping/sanitisation (DOMPurify, parameterised
   query), allow-lists (URLs, paths, fields).
1. If nothing adequate is found, the finding is confirmed: append it to
   `DRAFT_SECURITY_REPORT.md`. Otherwise note why it is safe (one line) and move
   on.
1. Mark the sub-task `[x]`.

## Example `SECURITY_ANALYSIS_TODO.md` evolution

```markdown
- [x] Build Firebase context map.
- [x] Define the audit scope.
- [x] SAST Recon on `firestore.rules`.
  - [x] Investigate `match /users/{userId}` allows any signed-in user to write `role`.
- [x] SAST Recon on `functions/src/index.ts`.
  - [x] Investigate data flow from `req.body.userId` on line 22.
  - [ ] Investigate data flow from `req.query.url` on line 41.
- [ ] SAST Recon on `src/app/actions.ts`.
- [ ] Final review of findings (minimise false positives) and write report.
```

Investigating line 22 found `db.doc('users/' + req.body.userId).update(...)`
with no `verifyIdToken` call -> IDOR via Admin SDK, appended to the draft.
