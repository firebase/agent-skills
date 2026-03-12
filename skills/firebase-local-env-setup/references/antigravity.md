# Antigravity Setup

To get the most out of Firebase in Antigravity, follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

The agent skills and MCP server should be installed globally for consistent access across projects.

### 1. Install Firebase Skills
Run the following command to install the Firebase agent skills:
```bash
npx skills add firebase/agent-skills --agent antigravity --skill "*" --yes --global
```

### 2. Configure Firebase MCP Server
The MCP server allows Antigravity to interact directly with Firebase projects.

1. Locate the `mcp_config.json` file in the system:
  - macOS / Linux: `~/.gemini/antigravity/mcp_config.json`  
  - Windows: `%USERPROFILE%\\.gemini\\antigravity\\mcp_config.json`
2. Add the `firebase` object to the `mcpServers` section in `mcp_config.json`:
    ```json
    "firebase": {
      "command": "npx",
      "args": [
        "-y",
        "firebase-tools@latest",
        "mcp"
      ]
    }
    ```
    For example, the `mcp_config.json` should look like this:
    ```json
    {
      "mcpServers": {
        "firebase": {
          "command": "npx",
          "args": [
            "-y",
            "firebase-tools@latest",
            "mcp"
          ]
        }
      }
    }
    ```

### 3. Verify and Restart
Run the following checks to confirm installation:
1. `npx skills list --agent antigravity --global` -> Output should include `firebase-basics`.
2. Open `mcp_config.json` -> Verify the `firebase` block is present.
3. Instruct the user to restart Antigravity and check the MCP server list in the UI to confirm `firebase-tools` is connected.
