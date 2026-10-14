# Reporting, Severity and False-Positive Control

Adapted from the
[Gemini CLI Security extension](https://github.com/gemini-cli-extensions/security/blob/main/GEMINI.md)
(Apache-2.0), with Firebase additions (`Firebase Service`, `Phase`,
`Confidence`, plain-language summary).

## Severity rubric

| Severity     | Impact                                                           | Likelihood / complexity                              | Firebase examples                                                                                                                                              |
| ------------ | ---------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | RCE, full compromise, read/modify **all** sensitive data         | Straightforward, no special privileges               | Open/test-mode Firestore rules on user data; service-account key committed; unauthenticated Admin-SDK endpoint that writes any doc; self-assignable admin role |
| **High**     | Read/modify sensitive data of **any** user, significant DoS/cost | May need an account (accounts are free) but reliable | `request.auth != null` on private data; IDOR in `onCall`; stored XSS; SSRF; secret key in client bundle; AI endpoint with no auth (denial-of-wallet)           |
| **Medium**   | Limited data, other users' experience, partial access            | Needs user interaction or is harder                  | Reflected XSS; PII in logs; storage rules without size/type limits; App Check not enforced on expensive endpoint; weak crypto                                  |
| **Low**      | Minimal impact, very hard to exploit                             | Unlikely preconditions                               | Verbose errors; missing security headers with no XSS sink; unrestricted browser API key with no billable API in use                                            |

Justify the severity in the description in one sentence.

## Phase tag (when should this have been caught?)

| Phase        | Meaning                                             | Examples                                                                                    |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `inline`     | Detectable while the code/config is being generated | Hardcoded secret, `if true` rules, `dangerouslySetInnerHTML` on user data, AI key in client |
| `pre-commit` | Needs the diff + some context                       | IDOR, missing auth check in a new function, mass assignment                                 |
| `pre-deploy` | Needs whole-app context or deployed state           | Rules drift, App Check not enforced, vulnerable dependencies, Hosting public dir leaks      |
| `continuous` | Depends on time or new advisories                   | New CVEs, test-mode rules expiring, leaked keys found later                                 |

## Finding format (use in draft and final report)

````markdown
### VULN-001: Firestore rules let any signed-in user read every user profile

- **ID:** VULN-001
- **Vulnerability:** Overly permissive Firestore rules (any authenticated user)
- **Vulnerability Type:** Security
- **Firebase Service:** Firestore Security Rules
- **Severity:** High
- **Confidence:** High
- **Phase:** inline
- **Source Location:** firestore.rules:8-10
- **Sink Location:** (privacy issues only)
- **Data Type:** (privacy issues only, e.g. Email Address)
- **Line Content:** `allow read, write: if request.auth != null;`
- **Description:** Anyone can create an account (anonymous auth is enabled), so
  every user's email and phone number in `/users` can be read and overwritten
  by any stranger. High because it exposes PII for all users and only needs a
  free account.
- **Recommendation:** Restrict to the owner and validate writes:

  ```
  match /users/{userId} {
    allow read, update: if request.auth != null && request.auth.uid == userId;
  }
  ```
````

Keep the field labels exactly as above - `report-to-json` parses them.

## Final report layout

1. **Summary (plain language, 3 lines max)** - what an attacker could do today
   and the single most important fix.
1. Table: ID | Severity | Title | File | Phase.
1. Detailed findings (format above), ordered by severity.
1. "Reviewed / not reviewed" - mode, files, whether deployed rules were
   compared, whether dependencies were scanned.
1. Footer: "AI-assisted first-pass review; not a substitute for a full audit."

## High-fidelity reporting principles

1. **Direct evidence.** Only report what is observable in the code you read. Do
   not speculate about other systems ("could be XSS if the template engine
   doesn't escape") unless you see escaping disabled. Exception: a dependency
   with a publicly documented vulnerability.
1. **Actionability.** The developer must be able to fix it by changing code or
   config in this repo. No philosophical/architectural essays.
1. **Executable code only.** Ignore commented-out code, docs, tests, mocks,
   fixtures, examples (`example.config.js`), emulator-only setup - unless they
   leak real production secrets.
1. **"So what?" test.** If there is no plausible negative impact, do not report
   it.
1. **Firebase false positives.** See section L of
   [firebase-checklist.md](firebase-checklist.md).

## Five-question final filter

A finding may be reported only if **all five** are "Yes":

1. Is it in executable, non-test code or deployed config?
1. Can I point to the specific line(s)?
1. Is it based on direct evidence, not a guess about another system?
1. Can the developer fix it by modifying the identified code/config?
1. Is there a plausible negative security impact in production?
