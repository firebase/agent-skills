# GitHub Copilot Setup

To get the most out of Firebase with GitHub Copilot in VS Code, follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

The agent skills and MCP server should be installed globally for consistent access across projects.

### 1. Install Firebase Skills
Run the following command to install the Firebase agent skills:
```bash
npx skills add firebase/agent-skills --agent github-copilot --skill "*" --yes --global
```

### 2. Configure Firebase MCP Server
The MCP server allows GitHub Copilot to interact directly with Firebase projects.

1. Locate the workspace `.vscode/mcp.json` or global User Settings `mcp.json` file.
2. Add the following to the configuration:
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
    For example, `.vscode/mcp.json` should look like this:
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
Run the following checks to confirm installation:
1. `npx skills list --agent github-copilot --global` -> Output should include `firebase-basics`.
2. Open the `mcp.json` configuration -> Verify the `firebase` block is present.
3. Instruct the user to restart VS Code and check the MCP server list in the UI to confirm `firebase-tools` is connected.
