- Update new Rules logic once chliang@ is done updating the firebase skill.
- Add a gcloud rules deploy (or agent tool for making the API call)
- Add a reference to scoring rules
- Write the gcloud deploy logic
- Figure out how to test this thing
- Write system instructions
- MCP server support
  - TODO: Add MCP for deployment (currently using gcloud CLI for v0)
- Sidecar ideas needed https://antigravity.google/docs/sidecars
  - How about a rules analyzer that runs antagonistically to the main model
  - wait for cloud run deployment and reports success or failure to the main model
  - "Sidecars can use the agentapi CLI to programmatically interact with Antigravity. The executable is automatically added to the sidecar’s path and available as agentapi."
  - Depends on AG environment (windows vs linux, python? etc)
  - Emulators? Interesting idea
- Hooks
  - Check rules score before deploying rules?
  - Does an MCP tool command work? The docs seem to suggest that only the AGY tools are matchable. Gemini says MCP tools work
  - ** This is a big deal - anything that we want to hook on should be an MCP tool execution **
  - Metrics tracking - lots of opportunities here
- Subagents ? can we have a rules subagent?


Deployment environments:
- Plugin works in CLI too hm?
- Antigravity (Google’s AI coding tool powered by Gemini) as an assistant directly inside Claude Code