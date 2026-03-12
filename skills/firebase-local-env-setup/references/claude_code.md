# Claude Code Setup

To get the most out of Firebase in Claude Code, follow these steps to install the agent skills and the MCP server.

## Recommended Method: Using Plugins

The recommended method is using the plugin marketplace to install both the agent skills and the MCP functionality.

### 1. Add Marketplaces
Run the following command to add the marketplace:
```bash
claude plugin marketplace add firebase/agent-skills
```

### 2. Install Plugins
Run the following command to install the plugin:
```bash
claude plugin install firebase@firebase
```

### 3. Verify
Run the following checks to confirm installation:
1. `claude mcp list` -> Output should include `firebase`.
2. `~/.claude/plugins/` folder should include `firebase`.

---

## Alternative: Manual Installation

If the plugin installation fails or is not preferred, run the following commands to install the MCP server and agent skills manually.

### 1. Add the MCP Server
```bash
claude mcp add firebase npx -- -y firebase-tools@latest mcp
```

### 2. Add the Agent Skills
```bash
npx skills add firebase/agent-skills --agent claude-code --skill "*" --yes --global
```

### 3. Verify
Run the following checks to confirm installation:
1. `claude mcp list` -> Output should include `firebase`.
2. `npx skills list --agent claude-code --global` -> Output should include `firebase-basics`.
