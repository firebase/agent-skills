# GitHub Copilot Setup

To get the most out of Firebase with GitHub Copilot in VS Code, follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

We recommend installing both the agent skills and the MCP server globally for consistent access across projects.

### 1. Install Firebase Skills
This provides the agent skills for working with Firebase.
```bash
npx skills add firebase/agent-skills --agent github-copilot --all --global
```

### 2. Configure Firebase MCP Server
The MCP server allows GitHub Copilot to interact directly with your Firebase projects.

1. Add the following to your workspace `.vscode/mcp.json` or your global User Settings:
    ```json
    "firebase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "firebase-tools@latest",
        "mcp"
      ]
    }
    ```
    For example, `.vscode/mcp.json` might look like this:
    ```json
    {
      "mcp": {
        "servers": {
          "firebase": {
            "type": "stdio",
            "command": "npx",
            "args": [
              "-y",
              "firebase-tools@latest",
              "mcp"
            ]
          }
        }
      }
    }
    ```

### 3. Verify and Restart
1. Run `npx skills list` to verify the `firebase-basics` skill is present.
2. Verify that the `firebase-tools` server is present in your configurations.
3. Restart VS Code and check the MCP server list in the UI to confirm `firebase-tools` is connected.
