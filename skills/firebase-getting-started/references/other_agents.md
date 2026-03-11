# Other Agents Setup

If you use another agent (like Windsurf, Cline, or Claude Desktop), follow these steps to install the agent skills and the MCP server.

## Recommended: Global Setup

We recommend installing both the agent skills and the MCP server globally for consistent access across projects.

### 1. Install Firebase Skills
This provides the agent skills for working with Firebase.
```bash
npx skills add firebase/agent-skills --all --global
```

### 2. Configure Firebase MCP Server
The MCP server allows your agent to interact directly with your Firebase projects.

1. Add the following to your agent's MCP configuration file (e.g., `~/.codeium/windsurf/mcp_config.json`, `cline_mcp_settings.json`, or `claude_desktop_config.json`):
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
    For example, the configuration file might look like this:
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
2. Verify that the `firebase-tools` server is present in your configuration.
3. Restart your agent and check the MCP server list in the UI to confirm `firebase-tools` is connected.
