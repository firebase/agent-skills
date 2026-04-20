---
name: codex-cli-basics
description: >-
  Core setup and usage guide for OpenAI Codex CLI on macOS/Linux (and WSL2 for
  Windows). Use when users need help installing Codex CLI, starting interactive
  sessions, choosing models/reasoning, using web search, running code review,
  working with Codex Cloud tasks, scripting via exec, or configuring MCP and
  approval modes.
---
# Codex CLI Basics

Use this skill when a user wants practical help with the Codex CLI workflow.

## Platform notes

- Codex CLI is available on macOS and Linux.
- Windows support is experimental; prefer WSL2 and Windows setup guidance.

## Setup workflow

1. Confirm the user wants local Codex CLI usage in a terminal.
2. Direct them to complete the standard CLI setup flow.
3. If they are new to Codex, recommend the best-practices guide before advanced tasks.

## Core commands and features

- Start interactive TUI: run `codex`.
- Switch model / reasoning in-session: use `/model`.
- Attach image inputs (screenshots/specs) when visual context matters.
- Generate/edit images when requested in CLI workflows.
- Run local code review before commit/push for safer changes.
- Use subagents to parallelize larger tasks.
- Use web search for up-to-date external information.
- Launch Codex Cloud tasks and apply resulting diffs locally.
- Use non-interactive `exec` mode to script repeatable workflows.
- Configure and use MCP for third-party tools/context.
- Choose approval modes based on user comfort and risk tolerance.

## Response guidance

- Keep instructions command-first and environment-aware.
- Prefer short checklists over long prose.
- If the user is on Windows, explicitly call out WSL2 as the recommended path.
- When the user asks "which model", explain tradeoffs and point to `/model`.
