# Firebase

Prototype, build & run modern apps that users love with Firebase's backend, AI,
and operational infrastructure.

This plugin equips Google Antigravity with official Firebase skills, specialized
subagents, and the Firebase MCP server so your agent can set up projects, model
data, author and verify security rules, and deploy apps.

## What's Included

### Skills

| Skill                                                       | What it covers                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Firebase Basics (`firebase-basics`)                         | CLI installation and login, project creation, `firebase init`, and app registration.   |
| Authentication (`firebase-auth-basics`)                     | Sign-in providers, user management, and securing data access with Firebase Auth.       |
| Cloud Firestore (`firebase-firestore`)                      | Databases, data modeling, queries, indexes, security rules, and SDK integration.       |
| Firestore Security Rules (`firestore-rules-creation`)       | Authoring, refactoring, and hardening production-grade `firestore.rules`.              |
| Security Rules Auditor (`firebase-security-rules-auditor`)  | Auditing Firestore and Cloud Storage rules for privilege escalation and bypasses.      |
| App Hosting (`firebase-app-hosting-basics`)                 | Deploying full-stack server-rendered Next.js and Angular web apps.                     |
| Hosting (`firebase-hosting-basics`)                         | Deploying static sites, SPAs, rewrites, headers, and custom domains.                   |
| Firebase AI Logic (`firebase-ai-logic-basics`)              | Calling Gemini and Imagen models directly from web and mobile apps.                    |
| Data Connect (`firebase-data-connect-basics`)               | PostgreSQL schemas, relations, queries, mutations, and generated SDKs.                 |
| Crashlytics (`firebase-crashlytics`)                        | Crash reporting setup and SDK integration.                                             |
| Remote Config (`firebase-remote-config-basics`)             | Feature flags, conditional parameters, and loading strategies.                         |
| Extensions to Functions (`extension-to-functions-codebase`) | Converting an installed Firebase Extension into a standalone Cloud Functions codebase. |
| Xcode Project Setup (`xcode-project-setup`)                 | Adding Firebase Swift Packages and linking files in `.pbxproj`.                        |

### Subagents

- **`firestore-rules-author`** — Dedicated subagent for architecting Firestore
  Security Rules and verifying them against the Firebase Emulator Suite before
  shipping.

### MCP Server

- **`firebase`** — Runs the `firebase-tools` MCP server
  (`npx -y firebase-tools@latest mcp`), enabling the agent to inspect your
  connected Firebase project and environment, manage Firebase resources, and
  query official Firebase documentation.

## Try It

- "Set up Firebase in my app and connect it to a Firebase project"
- "Add Firebase Authentication with Google sign-in to my app"
- "Write and audit Firestore security rules for my data model"
- "Add a Gemini-powered feature to my app with Firebase AI Logic"
- "Deploy my web app with Firebase App Hosting"

## Requirements

- **Node.js**: Required so the MCP server can run
  `npx -y firebase-tools@latest mcp`.
- **Firebase Account**: A Google account with access to a Firebase project. The
  agent can guide you through `firebase login` on first use.

## Learn More

- [Firebase Documentation](https://firebase.google.com/docs)
- [firebase/agent-skills on GitHub](https://github.com/firebase/agent-skills)
