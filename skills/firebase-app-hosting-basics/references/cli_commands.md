# App Hosting CLI Commands

The Firebase CLI provides a comprehensive suite of commands to manage App
Hosting resources. These commands are often faster and more scriptable than
using the Firebase Console.

## Initialization

### `npx -y firebase-tools@latest init apphosting`

- **Purpose**: Interactive command that sets up App Hosting in your local
  project. Use this command only if you are able to handle interactive CLI
  inputs well. Alternatively, you can manually edit `firebase.json` and
  `apphosting.yml`.

- **Effect**:

  - Detects your web framework.
  - Creates/updates `apphosting.yaml`.
  - Can optionally create a backend if one doesn't exist.

## Backend Management

### `npx -y firebase-tools@latest apphosting:backends:list`

- **Purpose**: Lists all backends in the current project.

### `npx -y firebase-tools@latest apphosting:backends:get <backend-id>`

- **Purpose**: Shows details for a specific backend.

### `npx -y firebase-tools@latest apphosting:backends:delete <backend-id>`

- **Purpose**: Deletes a backend and its associated resources.

## Secrets Management

App Hosting uses Cloud Secret Manager to securely handle sensitive environment
variables (like API keys).

### `npx -y firebase-tools@latest apphosting:secrets:set <secret-name>`

- **Purpose**: Creates or updates a secret in Cloud Secret Manager and makes it
  available to App Hosting.
- **Behavior**: Prompts for the secret value interactively, or reads from stdin
  via `printf '%s' '<value>'` with `--data-file - --force`.

### `npx -y firebase-tools@latest apphosting:secrets:grantaccess <secret-name>`

- **Purpose**: Grants the App Hosting service account permission to access the
  secret.
- **Note**: Pass `--backend <backend-id>` when reusing or updating an existing
  secret.

## Automated deployment via GitHub (CI/CD)

**IMPORTANT** Only use this command for GitHub CI/CD deployments, not with
`npx -y firebase-tools@latest deploy`.

### `npx -y firebase-tools@latest apphosting:rollouts:create <backend-id>`

- **Purpose**: Manually triggers a new rollout (deployment).
- **Options**:
  - `--git-branch <branch>`: Deploy the latest commit from a specific branch.
  - `--git-commit <commit-hash>`: Deploy a specific commit.
- **Use Case**: Useful for redeploying without code changes, or rolling back to
  a specific commit.

## Backend Creation

### `npx -y firebase-tools@latest apphosting:backends:create`

- **Purpose**: Creates a new App Hosting backend (pass `--backend`,
  `--primary-region`, and `--root-dir` for non-interactive deploys).
- **Options**:
  - `--app <webAppId>`: The ID of an existing Firebase web app to associate with
    the backend.
  - `--backend <backendId>`: The ID of the new backend.
  - `--primary-region <location>`: The primary region for the backend.
  - `--root-dir <rootDir>`: The root directory for the backend. If omitted,
    defaults to the root directory of the project.
  - `--service-account <service-account>`: The service account used to run the
    server. If omitted, defaults to the default service account.
