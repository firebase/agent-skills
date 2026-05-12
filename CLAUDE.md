# Firebase Agent Skills — Codebase Guide

## Project Overview

This repository is the **Firebase Agent Skills** library: a collection of AI agent instruction sets that extend coding-agent capabilities for Firebase development. Skills follow the [Agent Skills](https://agentskills.io/home) standard format and are consumed by Claude Code, Cursor, GitHub Copilot, Gemini CLI, and other AI coding tools.

The primary content is Markdown — each skill is a `SKILL.md` file with YAML frontmatter that agents load as context when working on Firebase projects.

---

## Repository Structure

```
agent-skills/
├── skills/                          # All agent skills (primary content)
│   ├── firebase-basics/
│   ├── firebase-auth-basics/
│   ├── firebase-firestore/
│   ├── firebase-hosting-basics/
│   ├── firebase-app-hosting-basics/
│   ├── firebase-data-connect-basics/
│   ├── firebase-crashlytics/
│   ├── firebase-ai-logic-basics/
│   ├── firebase-security-rules-auditor/
│   ├── xcode-project-setup/
│   ├── developing-genkit-js/        # Auto-synced from genkit-ai/skills
│   ├── developing-genkit-python/    # Auto-synced from genkit-ai/skills
│   ├── developing-genkit-go/        # Auto-synced from genkit-ai/skills
│   └── developing-genkit-dart/      # Auto-synced from genkit-ai/skills
├── scripts/
│   └── skill-token-counter/         # Node.js utility to measure skill token footprint
├── .github/
│   ├── workflows/
│   │   └── sync-genkit-skills.yml   # Scheduled sync from genkit-ai/skills repo
│   └── scripts/
│       ├── sync-skills.sh           # Copies + tags incoming Genkit skills
│       └── prune-skills.sh          # Removes deleted Genkit skills
├── .claude-plugin/                  # Claude plugin metadata
├── .cursor-plugin/                  # Cursor plugin metadata
├── kiro/                            # Kiro IDE integration files
├── assets/                          # Logo and branding assets
├── .mcp.json                        # Firebase MCP server config (repo-level)
├── gemini-extension.json            # Gemini CLI extension config
├── FIREBASE.md                      # Short context file for Firebase MCP usage
├── CONTRIBUTING.md                  # Contribution guidelines
└── README.md                        # Installation instructions
```

---

## Skill File Format

Each skill lives in `skills/<skill-name>/` and must contain a `SKILL.md` file.

### Directory Layout

```
skills/<skill-name>/
├── SKILL.md              # Required — main skill file
├── references/
│   ├── setup/            # Per-agent-environment setup guides
│   │   ├── claude_code.md
│   │   ├── cursor.md
│   │   ├── gemini_cli.md
│   │   ├── android_studio.md
│   │   ├── github_copilot.md
│   │   └── other_agents.md
│   ├── refresh/          # Per-agent-environment update/refresh guides
│   └── *.md              # Feature-specific reference docs
├── templates.md          # Optional (used by Data Connect skills)
└── examples.md           # Optional (used by Data Connect skills)
```

### SKILL.md Frontmatter Schema

```yaml
---
name: firebase-{feature-name}       # kebab-case, matches directory name
description: >-
  One-sentence description. Include the activation triggers (keywords/contexts
  that should cause an agent to load this skill).
compatibility: optional string      # Tool/platform requirements, if any
metadata:
  genkit-managed: true              # ONLY present on auto-synced Genkit skills
---
```

> **Do not** add `metadata.genkit-managed: true` manually. It is injected by the CI sync script. Genkit-managed skills will have their changes overwritten on the next sync.

### SKILL.md Body Conventions

- **Prerequisites** section first — environment checks, auth, active project setup.
- **Core Concepts** — foundational knowledge the agent needs.
- **Workflow Sections** — step-by-step numbered procedures.
- **References** — links to files in the `references/` subdirectory.
- **Common Issues** — troubleshooting tips.

Use GitHub-flavored Markdown. Blockquote admonitions (`> [!IMPORTANT]`) are supported.

---

## Key Conventions

### Firebase CLI — CRITICAL

Always use `npx` to ensure the latest CLI version is used:

```bash
# CORRECT
npx -y firebase-tools@latest <command>

# NEVER write this in a skill
firebase <command>
```

This applies everywhere in SKILL.md files: instructions, code blocks, and examples.

### Skill Tone

Skills are addressed to AI agents, not human users. Write imperatives like "Run `npx -y firebase-tools@latest --version`" rather than "You can run...".

### No Linting/Formatting Tooling

There is no ESLint, Prettier, or other formatter configured at the repo root. The `scripts/skill-token-counter/` subdirectory is a standalone Node.js package with its own `package.json`; it uses ES modules (`"type": "module"`).

### YAML Manipulation

The CI scripts use `yq` (not `jq`) to read and write SKILL.md frontmatter. Frontmatter must be valid YAML.

---

## Development Workflows

### Adding or Editing a Skill

1. Create or edit the relevant `skills/<name>/SKILL.md`.
2. Keep the frontmatter `name` field matching the directory name.
3. Add or update reference docs in `skills/<name>/references/` as needed.
4. Test the skill locally (see Testing below).
5. Open a PR targeting the correct branch (see Branch Strategy).

### Testing a Skill

**Option A — Install from a branch using the Agent Skills CLI:**
```bash
npx skills add https://github.com/firebase/skills/tree/<branch-name>
```

**Option B — Live symlink for active development (changes reflected immediately):**
```bash
# Example for Cursor
ln -s /path/to/agent-skills/skills /path/to/test-project/.cursor/rules
```

**Automated evals** are run externally in the [firebase-tools](https://github.com/firebase/firebase-tools/tree/main/scripts/agent-evals) repository. When adding a new skill, add matching test cases there to verify:
- The skill activates on the expected prompts.
- The agent succeeds on the tasks the skill is designed to help with.

### Token Counter Utility

Measures how many tokens a skill (or all skills) consumes — important for agent performance budgets.

```bash
cd scripts/skill-token-counter
npm install                         # First time only

# Count tokens in all skills
GEMINI_API_KEY=<your-key> node index.js ../../skills

# Compare against the main branch
GEMINI_API_KEY=<your-key> node index.js ../../skills --compare main

# JSON output (for CI/automation)
GEMINI_API_KEY=<your-key> node index.js ../../skills --json
```

---

## Branch Strategy

| Target branch | When to use |
|---|---|
| `main` | Incremental improvements to existing skills |
| `next` | New skills, new platform support, significant rewrites |

Both branches are protected and require PR review. Most users consume skills from `main`.

---

## CI/CD

### Genkit Skill Sync (`.github/workflows/sync-genkit-skills.yml`)

- **Trigger:** Weekdays at 9:00 AM EST, or manually via `workflow_dispatch`.
- **What it does:**
  1. Prunes skills deleted from `genkit-ai/skills` (script: `.github/scripts/prune-skills.sh`). Identified by `metadata.genkit-managed: true` in frontmatter.
  2. Copies updated skills from `genkit-ai/skills` and stamps them with `metadata.genkit-managed: true` using `yq` (script: `.github/scripts/sync-skills.sh`).
  3. Opens an automated PR using a bot account (`firebase-oss-bot@google.com`) with reviewers `joehan` and `ssbushi`.

**Do not manually edit Genkit-managed skills** (`developing-genkit-{js,python,go,dart}/`) — changes will be overwritten.

---

## Multi-Platform Configuration Files

| File | Purpose |
|---|---|
| `.mcp.json` | Defines the Firebase MCP server for this repo (used by Claude Code and Kiro) |
| `.claude-plugin/plugin.json` | Claude plugin metadata (name, description, keywords) |
| `.claude-plugin/marketplace.json` | Claude marketplace listing |
| `.cursor-plugin/plugin.json` | Cursor plugin metadata, points to `./skills/` |
| `gemini-extension.json` | Gemini CLI extension config (MCP server, theme, context file) |
| `kiro/mcp.json` | Local MCP server config for Kiro IDE |
| `FIREBASE.md` | Short context file loaded by Gemini CLI for Firebase MCP usage |

The MCP server entry point for all platforms:
```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["-y", "firebase-tools@latest", "mcp", "--dir", "."],
      "env": { "IS_FIREBASE_MCP": "true" }
    }
  }
}
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full process. Key points:
- Sign the [Google CLA](https://cla.developers.google.com/) before submitting.
- All submissions require GitHub PR review.
- Follow [Google's Open Source Community Guidelines](https://opensource.google/conduct/).
