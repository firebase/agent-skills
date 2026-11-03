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
  - Allegedly there's a nodejs environment shipped with AG via electron
  - Emulators? Interesting idea
- Hooks
  - Check rules score before deploying rules?
  - Does an MCP tool command work? The docs seem to suggest that only the AGY tools are matchable. Gemini says MCP tools work
  - Validate hooking on MCP or just gcloud commands
  - Metrics tracking - lots of opportunities here
- Subagents ? can we have a rules subagent?
  - Alternative to side-car is the polling subagent that checks when (for example) cloud run deploy completes
- Model assumes node for npx create-vite - maybe we can't get away from Node for web apps.
- Curl requests are scary looking for the user to approve, need to wrap in gocloud
- initializing firebase - need a firebase init in the plugin or firebase.json template inside gocloud
- npx firebase apps:sdkconfig WEB --project com-example-noteapp-f9b56
Deployment environments:
- Plugin works in CLI + AG2.0 + AGYIDE
- Antigravity (Google’s AI coding tool powered by Gemini) as an assistant directly inside Claude Code

Gcloud commands to add:
- npx firebase apps:sdkconfig WEB --project com-example-noteapp-f9b56
  - This is in response to printing the configData base64 object in the provisioning response.
- Create app provisioning API
  - Encapsulates the cURL command, can poll for operation completion, return firebaseconfig object
- Create database after the fact is necessary? Can provisioning API do it? likely
  - 1:1 DB model? in which case no need provisioning API
  - `gcloud firestore databases create --project=com-example-noteapp-f9b56 --location=us-central1 --type=firestore-native --edition=enterprise --enable-firestore-data-access --enable-realtime-updates`
- Upgrade to blaze using billing ID
Omit docker:
"""
Yes, you absolutely can omit the Dockerfile!

When you run gcloud run deploy --source . without a Dockerfile present, Cloud Run uses Google Cloud Buildpacks to automatically inspect your code, detect that it's a Node.js project, and build a container for you behind the scenes.

However, since this is a Vite-built React single-page application (SPA), omitting the Dockerfile requires a small tradeoff:

By default, the Node.js Buildpack expects a traditional web server and looks for an npm start script. To make it work without a Dockerfile, we would need to:

Install a static file server (like npm install serve)
Update the package.json to have a start script: "start": "serve -s dist"
The reason I explicitly generated the Dockerfile is because it allows us to use an ultra-lightweight NGINX image. NGINX is heavily optimized for serving static files and makes it trivial to add the try_files $uri $uri/ /index.html; configuration, which is required so that client-side routing (like React Router) doesn't return 404 Not Found errors when a user refreshes the page.

If you prefer to keep the repository clean of Docker-related files, we can easily delete the Dockerfile, install serve, and rely on Buildpacks instead! Let me know if you'd like me to make that switch
"""

Billing
- Probably don't want to block on billing, which is necessary for cloud run, but not necessary to run local
  - Does the provisioning API let me attach a billing instrument after project creation? need to test


Test/Questions:
- provisioning API attach billing
- provisioning API create DB after project provisioning initially
- Does the AIS cloud run deploy use docker?

TODO rn:
Enable google auth provider.
Ensure the project in gcloud matches the one in deployment

