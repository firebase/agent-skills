# Other Agents Setup

If you use another agent (like Windsurf, Cline, or Claude Desktop), follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

The agent skills and MCP server should be installed globally for consistent access across projects.

### 1. Install Firebase Skills
Run the following command to install the Firebase agent skills:
```bash
npx skills add firebase/agent-skills --skill "*" --yes --global
```

### 2. Configure Firebase MCP Server
The MCP server allows the agent to interact directly with Firebase projects.

1. Locate the agent's MCP configuration file (e.g., `~/.codeium/windsurf/mcp_config.json`, `cline_mcp_settings.json`, or `claude_desktop_config.json`).
2. Add the following to the configuration:
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
    For example, the configuration file should look like this:
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
1. `npx skills list --global` -> Output should include `firebase-basics`.
2. Open the configuration file -> Verify the `firebase` block is present.
3. Instruct the user to restart the agent and check the MCP server list in the UI to confirm `firebase-tools` is connected.
