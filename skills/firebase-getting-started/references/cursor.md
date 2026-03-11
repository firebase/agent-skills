# Cursor Setup

To get the most out of Firebase in Cursor, follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

We recommend installing both the agent skills and the MCP server globally for consistent access across projects.

### 1. Install Firebase Skills
This provides the agent skills for working with Firebase.
```bash
npx skills add firebase/agent-skills --agent cursor --all --global
```

### 2. Configure Firebase MCP Server
The MCP server allows Cursor to interact directly with your Firebase projects.

1. Add the following to your `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):
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
    For example, the `mcp.json` in your system might look like this:
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
1. Run `npx skills list` to verify the `firebase-basics` skill is present.
2. Verify that the `firebase-tools` server is present in your `mcp.json`.
3. Restart Cursor and check the MCP server list in the UI to confirm `firebase-tools` is connected.
