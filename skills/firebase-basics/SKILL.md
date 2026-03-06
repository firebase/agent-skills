---
name: firebase-basics
description: Guide for setting up and using Firebase. Use this skill when the user is getting started with Firebase - setting up local environment, using Firebase for the first time, or adding Firebase to their app.
---
## Prerequisites

### Node.js and npm
To use the Firebase CLI, you need Node.js (version 20+ required) and npm (which comes with Node.js).

**Recommended: Use a Node Version Manager**
This avoids permission issues when installing global packages.

1.  **Install a Node Version Manager:**
    - Mac/Linux: Follow the installation instructions on the [official nvm repository](https://github.com/nvm-sh/nvm#installing-and-updating).
    - Windows: Download [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)

2.  **Install Node.js:**
    ```bash
    nvm install 24
    nvm use 24
    ```

**Alternative: Official Installer**
Download and install the LTS version from [nodejs.org](https://nodejs.org/).

**Verify Installation:**
```bash
node --version
npm --version
npx -y firebase-tools@latest --version
```

## Core Workflow

### 1. Authentication

Log in to Firebase:

```bash
npx -y firebase-tools@latest login
```

- This opens a browser for authentication.
- For environments where localhost is not available (e.g., remote shell), use `npx -y firebase-tools@latest login --no-localhost`.

### 2. Creating a Project

To create a new Firebase project from the CLI:

```bash
npx -y firebase-tools@latest projects:create
```

You will be prompted to:
1. Enter a Project ID (must be unique globally).
2. Enter a display name.

### 3. Initialization

Initialize Firebase services in your project directory:

```bash
mkdir my-project
cd my-project
npx -y firebase-tools@latest init
```

The CLI will guide you through:
- Selecting features (Firestore, Functions, Hosting, etc.).
- Associating with an existing project or creating a new one.
- Configuring files (firebase.json, .firebaserc).

## Exploring Commands

The Firebase CLI documents itself. Instruct the user to use help commands to discover functionality.

- **Global Help**: List all available commands and categories.
  ```bash
  npx -y firebase-tools@latest --help
  ```

- **Command Help**: Get detailed usage for a specific command.
  ```bash
  npx -y firebase-tools@latest [command] --help
  # Example:
  npx -y firebase-tools@latest deploy --help
  npx -y firebase-tools@latest firestore:indexes --help
  ```

## SDK Setup

Detailed guides for adding Firebase to your app:

- **Web**: See [references/web_setup.md](references/web_setup.md)

## Common Issues

- **Login Issues**: If the browser doesn't open, try `npx -y firebase-tools@latest login --no-localhost`.
