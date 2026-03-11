# Claude Code Setup

To get the most out of Firebase in Claude Code, follow these steps to install the agent skills and the MCP server.

## Recommended Method: Using Plugins

We recommend using the plugin marketplace to install both the agent skills and the MCP functionality.

### 1. Add Marketplaces
```bash
claude plugin marketplace add firebase/agent-skills
```

### 2. Install Plugins
```bash
claude plugin install firebase@firebase
```

## Alternative: Manual Installation

If you prefer to install the MCP server and agent skills manually instead of using plugins, run the following commands.

### 1. Add the MCP Server
```bash
claude mcp add firebase npx -- -y firebase-tools@latest mcp
```

### 2. Add the Agent Skills
```bash
npx skills add firebase/agent-skills --agent claude-code --all --global
```
