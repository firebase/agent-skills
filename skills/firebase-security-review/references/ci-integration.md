# CI Integration (GitHub Actions)

Two complementary jobs. The first is deterministic and free (no LLM); the second
runs the full AI review on the PR diff.

## 1. Deterministic guardrail: dependency scan

Fails the build on Critical/High advisories in **production** dependencies. Uses
the zero-install OSV.dev fallback of `firebase-dependency-scan`.

```yaml
name: Firebase dependency scan
on: [pull_request]
permissions:
  contents: read
jobs:
  osv:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Fetch Firebase agent skills
        run: git clone --depth 1 https://github.com/firebase/agent-skills /tmp/firebase-skills
      - name: Scan
        run: |
          node /tmp/firebase-skills/skills/firebase-dependency-scan/scripts/scan_deps.mjs \
            --format json --out osv-report.json > /dev/null
          node -e '
            const r = require("./osv-report.json");
            console.log(JSON.stringify(r.summary));
            process.exit(r.summary.CRITICAL + r.summary.HIGH > 0 ? 1 : 0);'
```

## 2. AI security review of the PR (Gemini CLI)

Uses [run-gemini-cli](https://github.com/google-github-actions/run-gemini-cli)
with this repository installed as an extension (which loads the skills). Follow
its Quick Start to configure `GEMINI_API_KEY` or Vertex AI / Workload Identity.

```yaml
name: Firebase security review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: google-github-actions/run-gemini-cli@v0
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          extensions: |
            ["https://github.com/firebase/agent-skills"]
          prompt: |
            Use the firebase-security-review skill in non-interactive CI mode.
            Mode: Diff, base origin/${{ github.base_ref }}.
            Do not ask questions. Write .firebase-security/SECURITY_REPORT.md
            and .firebase-security/security_report.json, then print the
            summary line CRITICAL=<n> HIGH=<n> MEDIUM=<n> LOW=<n>.
      - name: Comment report on PR
        if: always()
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          test -f .firebase-security/SECURITY_REPORT.md && \
            gh pr comment ${{ github.event.pull_request.number }} \
              --body-file .firebase-security/SECURITY_REPORT.md || true
```

To gate merges, add a step that parses `security_report.json` and fails when any
finding has `severity` `Critical` (recommended) or `High`.

## Other agents

The same prompt works with any agent that can run in CI and load Agent Skills
(e.g. Claude Code via `npx skills add firebase/skills`). Keep CI runs read-only:
never give the CI agent deploy credentials.
