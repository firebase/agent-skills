---
name: firebase-security-patcher
description: >-
  Fixes security vulnerabilities in a Firebase app using a PoC -> patch -> verify loop: baseline tests, apply a minimal secure fix from a vulnerability knowledge base (rules, Cloud Functions auth, IDOR, secrets, XSS, injection, SSRF, path traversal, AI/LLM, dependencies), re-run the PoC and tests, and re-scan. Invoke this as the first action whenever the user asks to fix, patch, remediate or harden a security issue or a finding from firebase-security-review. Don't use for general bug fixes or for writing brand-new rules from scratch (use firestore-rules-creation).
metadata:
  author: Google LLC
  category: CloudSecurity
---

# Firebase Security Patcher

Apply the **smallest secure change** that removes the vulnerability without
breaking the app, and prove it. Ports the `security-patcher` skill and
`security_patch_context` knowledge base of the
[Gemini CLI Security extension](https://github.com/gemini-cli-extensions/security),
extended with Firebase-specific fixes.

## Knowledge base

Pick the article(s) matching the vulnerability and follow their secure patterns.
Do not improvise a different pattern when one is given.

| Vulnerability                                                                            | Article                                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Firestore / Storage / RTDB rules                                                         | [references/knowledge/security-rules.md](references/knowledge/security-rules.md)               |
| Missing auth / IDOR in Functions, API routes, Server Actions; mass assignment; App Check | [references/knowledge/server-access-control.md](references/knowledge/server-access-control.md) |
| Hardcoded / leaked secrets, client-exposed keys                                          | [references/knowledge/secrets.md](references/knowledge/secrets.md)                             |
| XSS, SQL/NoSQL/command injection, SSTI, open redirect                                    | [references/knowledge/injection-xss.md](references/knowledge/injection-xss.md)                 |
| SSRF                                                                                     | [references/knowledge/ssrf.md](references/knowledge/ssrf.md)                                   |
| Path traversal                                                                           | [references/knowledge/path-traversal.md](references/knowledge/path-traversal.md)               |
| Prompt injection, unsafe LLM output, AI abuse                                            | [references/knowledge/llm-safety.md](references/knowledge/llm-safety.md)                       |
| Vulnerable dependencies                                                                  | [references/knowledge/dependencies.md](references/knowledge/dependencies.md)                   |
| Anything else                                                                            | General secure-coding knowledge; state that no article applied                                 |

## Workflow

1. **Prerequisites.**
   - Look for `.firebase-security/SECURITY_REPORT.md` (or a legacy
     `.gemini_security/` report). If none exists and the user did not describe
     the issue precisely, run `firebase-security-review` first to build context.
   - Identify and run the project's existing checks (`npm test`,
     `npm run build`, `npm run lint`, `pytest`, `go test ./...`, `flutter test`,
     rules unit tests). Record the baseline result. If the baseline is already
     failing, tell the user and continue, but compare against that baseline
     later.
1. **Gather context.** Read the vulnerable file in full, its callers, and the
   matching knowledge-base article. For rules fixes, also read the client code
   that queries the affected collections so the fix keeps legitimate queries
   working ("rules are not filters").
1. **Prepare the patch.** Formulate a minimal fix using the article's secure
   pattern. Show the user the diff (or full rules block) and a one-sentence
   explanation of what an attacker could do before vs. after.
1. **Confirm verification intent.** Ask: "Verify this fix with a
   Proof-of-Concept? (Yes/No)" - recommend **Yes** for Critical/High. In
   non-interactive mode assume Yes when tooling allows.
1. **Verify the vulnerability exists (before patching).** If a PoC exists in
   `.firebase-security/poc/`, run it; otherwise create one with
   `firebase-security-poc`. Expect `POC_RESULT: VULNERABLE`. If it reports
   `NOT_VULNERABLE`, stop and discuss - the finding may be a false positive.
1. **Apply the patch** to the target file(s). For Firestore rules, if the
   `firestore-rules-author` subagent is available, delegate the rules edit to it
   with the finding and PoC path as context; otherwise follow
   `firestore-rules-creation` principles directly.
1. **Verify the fix (after patching).**
   - Re-run the **same** PoC unchanged -> expect `POC_RESULT: NOT_VULNERABLE`.
   - Run a positive check that a legitimate user can still do the intended
     action (add it to the PoC or a test).
   - Re-run the baseline checks; they must be no worse than before.
   - For rules, validate syntax with the Firebase MCP
     `firebase_validate_security_rules` tool if available.
   - Re-run `firebase-security-review` in Diff mode on the changed files to
     catch regressions or new issues introduced by the fix.
1. **Report.** For each fixed finding: status (`Fixed and verified`,
   `Fixed - not verified (reason)`, `Not fixed (reason)`), files changed, PoC
   before/after verdicts, test results. Update the finding in
   `.firebase-security/SECURITY_REPORT.md` with the status.
1. **Deployment reminder.** Rules, Functions and App Hosting changes are not
   live until deployed. Do **not** deploy yourself; tell the user the exact
   command (e.g. `firebase deploy --only firestore:rules`) or suggest the
   Firebase deploy workflow, and remind them to rotate any secret that was ever
   committed or shipped.

## Rules for good security patches

- Fix the root cause at the trust boundary (rules, server handler), not by
  hiding UI or adding client-side checks.
- Prefer platform features over custom code: Security Rules, `request.auth`,
  `verifyIdToken`, App Check, `defineSecret`/Secret Manager, parameterised
  queries, framework auto-escaping, DOMPurify.
- Keep the patch minimal and in the codebase's style; add a short comment only
  where the security reason is non-obvious.
- Never weaken another control to make a test pass. Never delete or skip failing
  tests.
- One finding at a time when they touch the same file, re-verifying after each.
