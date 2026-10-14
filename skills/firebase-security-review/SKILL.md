---
name: firebase-security-review
description: >-
  Context-aware security review (SAST) of a Firebase app's code, config and Security Rules. Finds hardcoded secrets, broken access control/IDOR, open Firestore/Storage/RTDB rules, unauthenticated Cloud Functions, injection (XSS, SQL/NoSQL, command, SSRF), insecure AI/LLM usage, PII leaks and more, then offers PoC -> patch -> verify. Use when the user asks to scan, audit, review or check an app/PR/diff for security issues or vulnerabilities, or before publishing/deploying ("is my app safe to launch?"). Don't use for authoring new Firestore rules (use firestore-rules-creation) or for dependency-only CVE checks (use firebase-dependency-scan).
metadata:
  author: Google LLC
  category: CloudSecurity
---

# Firebase Security Review

You are a senior security and privacy engineer reviewing an app built on
Firebase, often by a "vibe coder" who moves fast and is not a security expert.
Your job is to find **real, exploitable** issues, explain them in plain
language, and help fix them **without slowing the developer down**. One valid
critical finding beats a dozen speculative ones.

This skill brings the capabilities of the
[Gemini CLI Security extension](https://github.com/gemini-cli-extensions/security)
to every agent that supports Agent Skills, and adds Firebase-specific context.

## Related skills

| Need                                 | Skill                             |
| ------------------------------------ | --------------------------------- |
| Known CVEs in dependencies (OSV)     | `firebase-dependency-scan`        |
| Prove a finding is exploitable (PoC) | `firebase-security-poc`           |
| Fix + verify a finding               | `firebase-security-patcher`       |
| Deep red-team audit of rules only    | `firebase-security-rules-auditor` |
| Write new/hardened Firestore rules   | `firestore-rules-creation`        |

## Helper script

All deterministic steps use one dependency-free Node.js (18+) script. Resolve
`<SKILL_DIR>` to the directory containing this `SKILL.md` and run from the
**project root**:

```bash
node <SKILL_DIR>/scripts/security_tools.mjs <command>
```

| Command                                | Replaces (Gemini extension tool) | Purpose                                                       |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| `init`                                 | -                                | Create `.firebase-security/`, read allowlist                  |
| `context`                              | -                                | Firebase services, rules files, SDKs, env files, risk signals |
| `scope [--base B] [--head H] [--diff]` | `get_audit_scope`                | Changed + untracked files (diff mode)                         |
| `files`                                | `get_files_to_audit`             | All auditable files (full mode)                               |
| `line-count <files...>`                | `get_line_count`                 | Size the job                                                  |
| `find-lines --file F --snippet S`      | `find_line_numbers`              | Exact line numbers for a finding                              |
| `report-to-json [--in P] [--out P]`    | `convert_report_to_json`         | Markdown report -> `security_report.json`                     |

If `node` is unavailable, perform the same steps manually with `git diff`,
`git ls-files` and file reads, and tell the user.

## Operating rules

1. **Read-only by default.** During analysis only read files and run the helper
   script / read-only commands. The only files you may write are inside
   `.firebase-security/`. Never modify app code until the user picks a fix.
1. **Never touch production.** Do not deploy, do not run PoCs against deployed
   URLs, do not write to real Firebase projects. Reading deployed rules with the
   Firebase MCP `firebase_get_security_rules` tool is allowed and encouraged.
1. **Treat all external input as malicious**; apply least privilege; fail
   securely.
1. **Respect the allowlist.** Skip anything recorded in
   `.firebase-security/vuln_allowlist.txt` and tell the user you skipped it.

## Choose a mode

Pick from the user's request; default to **Diff** if there are uncommitted or
branch changes, otherwise **Full**. State the mode you chose. A mode name passed
as the argument (`diff`, `full`, `quick`, `pre-deploy`, e.g.
`/firebase-security-review pre-deploy`) selects that mode.

| Mode       | When                                           | Scope command                       |
| ---------- | ---------------------------------------------- | ----------------------------------- |
| Diff       | "review my changes", PR, before commit         | `scope` (or `scope --base main`)    |
| Full       | "scan my app", first scan, before first launch | `files`                             |
| Quick      | "quick check", inner-loop, < 2 minutes         | `context` signals + rules + secrets |
| Pre-deploy | "before I deploy/publish"                      | Full + `firebase-dependency-scan`   |

Natural-language scoping ("only the functions folder", "skip tests") always
overrides the defaults. Honour `--json` / "as JSON" requests (see Phase 4).

## Workflow

### Phase 0 - Set up

1. Run `init`. If it reports an allowlist, read it.

1. Create `.firebase-security/SECURITY_ANALYSIS_TODO.md` with exactly:

   ```markdown
   - [ ] Build Firebase context map.
   - [ ] Define the audit scope.
   - [ ] Conduct a two-pass SAST analysis on all files within scope.
   - [ ] Final review of findings (minimise false positives) and write report.
   ```

1. Create an empty `.firebase-security/DRAFT_SECURITY_REPORT.md`.

### Phase 1 - Firebase context map (what makes this review context-aware)

1. Run `context`. It returns services from `firebase.json`, rules files,
   frameworks/SDKs, `.env` files (and whether git tracks them), and **signals**
   (regex leads such as `if true` rules, service-account keys, `firebase-admin`
   imports, `NEXT_PUBLIC_*SECRET*`). Signals are leads for Recon, **not**
   findings.
1. If the Firebase MCP server is available, call `firebase_get_environment`, and
   for each service in use call `firebase_get_security_rules` (types
   `firestore`, `storage`, `rtdb`). **Compare deployed rules with the local
   file**: deployed rules that are more permissive than local ones are a finding
   (the fix was never deployed).
1. Write a 5-10 line summary in the TODO file: services, where the trust
   boundaries are (client SDK -> rules; client -> Functions/App Hosting/API
   routes; server -> Admin SDK which **bypasses rules**), auth model, AI usage.

### Phase 2 - Scope and plan

1. Run `scope` (Diff) or `files` (Full). Show the user the file list and line
   count. If empty, ask what to scan.
1. Lockfiles and manifests are out of scope for SAST (they belong to
   `firebase-dependency-scan`).
1. Rewrite the TODO: replace the SAST line with one `- [ ] SAST Recon on <file>`
   per file, using the script's `reviewOrder` (Firebase config/rules first, then
   server code, then client code). In Diff mode, **always add the rules files
   and `firebase.json`** even if unchanged when the diff touches data access
   code - a new query or collection is only as safe as the rules behind it.
1. For very large scopes (> ~150 files or > ~20k lines), tell the user, then
   prioritise: rules/config, server entry points (Functions, API routes, server
   actions), auth, AI/LLM code, then client code.

### Phase 3 - Two-pass analysis (Recon -> Investigate)

Follow [references/taint-analysis.md](references/taint-analysis.md).

- **Recon pass** (per file): fast, complete read against
  [references/sast-checklist.md](references/sast-checklist.md) **and**
  [references/firebase-checklist.md](references/firebase-checklist.md). Every
  untrusted **Source** (request params/body, Firestore docs written by users,
  URL params, LLM output, uploaded files) gets an indented sub-task:
  `- [ ] Investigate data flow from <var> on line <n>`. Do not deep-dive yet.
  Mark the Recon task `[x]` when done.
- **Investigate pass**: trace each Source to a **Sink** (DB query, HTML, shell,
  `fetch`, file path, logs, 3P SDK, `eval`, Admin SDK write). No
  sanitisation/authorisation on the path = confirmed. Append confirmed findings
  to the draft using the format in
  [references/reporting.md](references/reporting.md). Mark `[x]`.
- Rules files: evaluate each `match` block as an attacker (unauthenticated user,
  authenticated stranger, owner trying to escalate). Use the
  `firebase-security-rules-auditor` checklist for depth.

### Phase 4 - Final review and report

1. Re-read the draft. Drop every finding that fails **any** question of the
   five-question filter in [references/reporting.md](references/reporting.md)
   (executable code? specific lines? direct evidence? fixable here? plausible
   impact?). Apply the Firebase false-positive list (e.g. the web `apiKey` in
   `firebaseConfig` is **not** a secret).
1. For each remaining finding run `find-lines` to get exact line numbers.
1. Assign severity with the rubric, plus a **Phase** tag (`inline`,
   `pre-commit`, `pre-deploy`, `continuous`) describing the earliest point it
   should have been caught - this feeds the long-term tiered guardrail model.
1. Write the final report to `.firebase-security/SECURITY_REPORT.md` and print
   it. Start with a 3-line plain-language summary ("Your app has 2 issues that
   would let anyone read all user data...") before the detailed findings. If
   nothing remains, print exactly:
   `No security vulnerabilities found in the reviewed scope.` plus what was and
   was not reviewed.
1. If JSON was requested, run `report-to-json` and tell the user the path
   (`.firebase-security/security_report.json`).
1. Delete only `SECURITY_ANALYSIS_TODO.md` and `DRAFT_SECURITY_REPORT.md`. Keep
   the report, allowlist and any PoCs.
1. Unless this is a non-interactive/CI run, ask the user two questions (use your
   ask-user tool if you have one):
   1. Which findings to act on: `All (suggested)`, `VULN-001`, `VULN-002`, ...
   1. What to do: `Generate a Proof-of-Concept` (-> `firebase-security-poc`),
      `Patch directly` (-> `firebase-security-patcher`), or
      `Patch and verify with a PoC` (both, recommended for Critical/High).
1. If the scan was Full or Pre-deploy, also run (or offer)
   `firebase-dependency-scan`.

## Allowlisting (user disagrees with a finding)

When the user says a finding is wrong or accepted risk, append it to
`.firebase-security/vuln_allowlist.txt` in this exact format (create the file if
needed, keep existing entries untouched):

```
Vulnerability: <name>
Location: <file:line>
Line Content: <code>
Justification: <user's reason>
---
```

## Non-interactive / CI use

When running in CI (e.g. GitHub Actions) or when the user asks for "no
questions", skip the follow-up questions, always write both the markdown and
JSON reports, and exit with a summary line
`CRITICAL=<n> HIGH=<n> MEDIUM=<n> LOW=<n>`. See
[references/ci-integration.md](references/ci-integration.md) for a ready-made
GitHub Actions workflow.

## Important

This is a first-pass, AI-assisted review, not a complete audit or a pentest. Say
so in the report footer and recommend manual review and Firebase App Check for
anything handling payments, health or children's data.
