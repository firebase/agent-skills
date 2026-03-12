# Cursor Setup

To get the most out of Firebase in Cursor, follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

The agent skills and MCP server should be installed globally for consistent access across projects.

### 1. Install Firebase Skills
Run the following command to install the Firebase agent skills:
```bash
npx skills add firebase/agent-skills --agent cursor --skill "*" --yes --global
```

### 2. Configure Firebase MCP Server
The MCP server allows Cursor to interact directly with Firebase projects.

1. Locate the `mcp.json` file. Add the following to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):
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
    For example, the `mcp.json` should look like this:
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
1. `npx skills list --agent cursor --global` -> Output should include `firebase-basics`.
2. Open `mcp.json` -> Verify the `firebase` block is present.
3. Instruct the user to restart Cursor and check the MCP server list in the UI to confirm `firebase-tools` is connected.
