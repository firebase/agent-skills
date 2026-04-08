---
name: firebase
description: Manages Firebase projects, apps, and services including Firestore, Authentication, Hosting, and Cloud Functions. Use this skill when the user asks to manage Firebase resources or implement mobile/web backend features.
---


## Quick Start


1.  **Ensure NPM is installed.**


    ```bash
    ## Check if NPM is installed
    npm –version
    ```


    If NPM is not installed, guide the user to download and install the LTS version from https://nodejs.org/en/download.


    Then, request the user to manually install Node.js and to reply with a confirmation that the installation is finished. **Stop and wait** for the user's confirmation.


2.  **Install Agent Skills for Firebase.**


    These skills provide detailed guides on Firebase best practices and how to use different Firebase products and tools. For example, these skills help with creating and setting up a Firebase project, getting started with the client-side SDKs, and setting up and using Firebase products (like Firebase Authentication, Firestore, and Firebase AI Logic).


    Run this command:


    ```bash
    npx -y skills add firebase/agent-skills -y
    ```


3.  **Log in to the Firebase CLI.**


    Run this command:


    ```bash
    npx -y firebase-tools@latest login
    ```


    Then, ask the user to complete the login flow in the browser.


4.  **Set an active project for the CLI.**


    Most Firebase tasks require an active project context. Check the current project for the Firebase CLI by running this command:


    ```bash
    npx -y firebase-tools@latest use`
    ```


    - If the command outputs `Active Project: <PROJECT_ID>`, you can proceed with your task.
    - If not, ask the user if they have an existing Firebase project ID.
      - If yes: Set the ID as the active project and add a default alias by running:
        ```bash
        npx -y firebase-tools@latest use --add <PROJECT_ID>
        ```
      - If no: Create a new Firebase project by running:
	  ```bash
	  npx -y firebase-tools@latest projects:create <PROJECT_ID> –display-name <DISPLAY_NAME>
	  ```


## Reference directory


- [Firebase core concepts](references/core-concepts.md)
- [Firebase CLI usage](references/cli-usage.md)
- [Firebase client library usage](references/client-library-usage.md)
- [Firebase CLI and MCP server](references/mcp-usage.md)
- [Firebase IaC usage](references/iac-usage.md)
- [Firebase security-related features](references/iam-security.md)


If you need product information that's not found in these references, check the other skills for Firebase that you have installed, or use the
`search_documents` tool of the Developer Knowledge MCP server.
