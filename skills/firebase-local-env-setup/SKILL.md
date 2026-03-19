---
name: firebase-local-env-setup
description: Bare minimum INITIAL setup for getting started with Firebase (Node.js, CLI installation, first-time login). Use ONLY for first-time setup. For updating, troubleshooting, or refreshing an existing environment, use the firebase-basics skill instead.
---

# Firebase Local Environment Setup

This skill documents the bare minimum setup required for a full Firebase experience for the agent. Before starting to use any Firebase features, you MUST verify that each of the following steps has been completed.

## 1. Verify Node.js
- **Action**: Run `node --version`.
- **Handling**: Ensure Node.js is installed and the version is `>= 20`. If Node.js is missing or `< v20`, install it based on the operating system:

  **Recommended: Use a Node Version Manager**
  This avoids permission issues when installing global packages.

  **For macOS or Linux:**
  1. Guide the user to the [official nvm repository](https://github.com/nvm-sh/nvm#installing-and-updating).
  2. Request the user to manually install `nvm` and reply when finished. **Stop and wait** for the user's confirmation.
  3. Make `nvm` available in the current terminal session by sourcing the appropriate profile:
     ```bash
     # For Bash
     source ~/.bash_profile
     source ~/.bashrc

     # For Zsh
     source ~/.zprofile
     source ~/.zshrc
     ```
  4. Install Node.js:
     ```bash
     nvm install 24
     nvm use 24
     ```

  **For Windows:**
  1. Guide the user to download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases).
  2. Request the user to manually install `nvm-windows` and Node.js, and reply when finished. **Stop and wait** for the user's confirmation.
  3. After the user confirms, verify Node.js is available:
     ```bash
     node --version
     ```

  **Alternative: Official Installer**
  1. Guide the user to download and install the LTS version from [nodejs.org](https://nodejs.org/en/download).
  2. Request the user to manually install Node.js and reply when finished. **Stop and wait** for the user's confirmation.

## 2. Verify Firebase CLI
The Firebase CLI is the primary tool for interacting with Firebase services.
- **Action**: Run `npx -y firebase-tools@latest --version`.
- **Handling**: Ensure this command runs successfully and outputs a version number.

## 3. Verify Firebase Authentication
You must be authenticated to manage Firebase projects.
- **Action**: Run `npx -y firebase-tools@latest login`.
- **Handling**: If the environment is remote or restricted (no browser access), run `npx -y firebase-tools@latest login --no-localhost` instead.

## 4. Install Agent Skills and MCP Server
To fully manage Firebase, the agent needs specific skills and the Firebase MCP server installed. Identify the agent environment you are currently running in and follow the corresponding setup document strictly.

**Read the setup document for your current agent:**
- **Gemini CLI**: Review [references/gemini_cli.md](references/gemini_cli.md)
- **Antigravity**: Review [references/antigravity.md](references/antigravity.md)
- **Claude Code**: Review [references/claude_code.md](references/claude_code.md)
- **Cursor**: Review [references/cursor.md](references/cursor.md)
- **GitHub Copilot**: Review [references/github_copilot.md](references/github_copilot.md)
- **Other Agents** (Windsurf, Cline, etc.): Review [references/other_agents.md](references/other_agents.md)

---
**CRITICAL AGENT RULE:** Do NOT proceed with any other Firebase tasks until EVERY step above has been successfully verified and completed.
