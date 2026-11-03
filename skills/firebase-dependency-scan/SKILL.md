---
name: firebase-dependency-scan
description: >-
  Scans a Firebase app's dependencies (npm, yarn, pnpm, PyPI, Go, Dart/Flutter pub, RubyGems, Cargo, Composer, Gradle lockfiles) for known vulnerabilities using OSV-Scanner or the OSV.dev database, prioritises them for a Firebase app, and guides safe upgrades. Use when the user asks to check dependencies/packages/libraries for CVEs or known vulnerabilities, run an SCA/supply-chain scan, or before deploying. Don't use for reviewing the app's own source code (use firebase-security-review).
metadata:
  author: Google LLC
  category: CloudSecurity
---

# Firebase Dependency Scan

Find known-vulnerable open-source dependencies and tell the user which ones
actually matter, in priority order. Equivalent to `/security:scan-deps` in the
[Gemini CLI Security extension](https://github.com/gemini-cli-extensions/security),
which uses [OSV-Scanner](https://github.com/google/osv-scanner) and the
[OSV.dev](https://osv.dev) database.

## Run the scan

Resolve `<SKILL_DIR>` to the directory containing this `SKILL.md`, then from the
project root:

```bash
node <SKILL_DIR>/scripts/scan_deps.mjs --format markdown
```

- Uses `osv-scanner` automatically if it is installed; otherwise parses
  lockfiles itself and queries the public OSV.dev API (no install, no API key,
  only package names/versions are sent).
- Dev dependencies are excluded by default; add `--include-dev` to include them
  (do so if the user asks, or when build tooling is in scope).
- `--format json --out .firebase-security/deps_report.json` for machine output.
- `node <SKILL_DIR>/scripts/scan_deps.mjs details <ID>` fetches full advisory
  details (affected ranges, references) for one vulnerability.
- If it reports `No supported lockfiles found` but there is a `package.json`,
  ask before running `npm install --package-lock-only` (it only writes the
  lockfile) and rescan.

## Analyse and prioritise

Ignore lockfiles under test/fixture/example directories. Then rank findings
using, in order:

1. **Severity** (Critical > High > Medium > Low) and CVSS score.
1. **Reachability in this app.** Is the package used in code that runs in
   production (server: Cloud Functions, App Hosting, API routes; client bundle)?
   Search for imports of the package. Build-only tooling (bundlers, test
   runners, linters) is lower priority unless the advisory affects the dev
   server (e.g. Vite/webpack dev-server file disclosure while running locally).
1. **Firebase-relevant hot spots** - raise priority when the vulnerable package
   is: `next` (middleware auth bypass, SSRF, cache poisoning), `firebase-admin`,
   `firebase-functions`, `express`/`body-parser`/`path-to-regexp`, `axios`/
   `node-fetch`/`undici` (SSRF, header leaks), `jsonwebtoken`/`jose` (auth),
   `protobufjs`, `ws`, `@grpc/grpc-js`, `genkit`/AI SDKs, image/file parsers
   handling user uploads.
1. **Direct vs transitive.** Direct deps are easy to fix; transitive ones may
   need a parent upgrade or an `overrides`/`resolutions` entry.
1. **Fix availability** (`fixedIn`). No fix = mitigation/acceptance decision.

## Report

Present:

1. One-line summary (`3 critical, 5 high in production dependencies`).
1. A table: Severity | Package | Installed | Fixed in | Direct? | Why it matters
   here | Advisory link.
1. The recommended upgrade commands, grouped so one command fixes many findings
   (e.g. `npm install next@<fixed>`), noting major-version jumps that may break
   the app.

Do **not** modify `package.json` or lockfiles during the scan.

## Fix (only after the user agrees)

Follow the patch -> verify loop from `firebase-security-patcher` (vulnerability
type `dependency`):

1. Run the existing test suite / build to get a baseline.
1. Upgrade the minimum set of packages to a fixed version (prefer the smallest
   non-major bump that fixes the issue). For transitive deps use the package
   manager's override mechanism (`overrides` in npm, `resolutions` in yarn,
   `pnpm.overrides`).
1. Re-run the build/tests, then re-run `scan_deps.mjs` and confirm the advisory
   is gone.
1. For Cloud Functions, remember `functions/` has its own `package.json` and
   lockfile.

## Ignoring a finding

If the user accepts a risk, record it in `osv-scanner.toml` at the project root
(the format OSV-Scanner itself uses, honoured by the script):

```toml
[[IgnoredVulns]]
id = "GHSA-xxxx-xxxx-xxxx"
reason = "Only used by a local build script; not shipped."
```

## Limits

Only exact versions from lockfiles can be matched; ranges in manifests without a
lockfile cannot. OSV coverage for CocoaPods/Swift Package Manager is limited.
This scan does not detect malicious or typo-squatted packages that have no
advisory yet - when reviewing newly added dependencies, also sanity-check the
package name, publisher, download count and age (AI agents sometimes hallucinate
package names).
