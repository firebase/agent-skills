---
name: firebase-app-hosting-basics
description: Deploy and manage web apps with Firebase App Hosting. Use this skill when deploying Next.js/Angular apps with backends.
---

# App Hosting Basics

## Description

This skill enables the agent to deploy and manage modern, full-stack web
applications (Next.js, Angular, etc.) using Firebase App Hosting.

**Important**: In order to use App Hosting, your Firebase project must be on the
Blaze pricing plan. Direct the user to
https://console.firebase.google.com/project/_/overview?purchaseBillingPlan=metered
to upgrade their plan.

## Hosting vs App Hosting

**Choose Firebase Hosting if:**

- You are deploying a static site (HTML/CSS/JS).
- You are deploying a simple SPA (React, Vue, etc. without SSR).
- You want full control over the build and deploy process via CLI.

**Choose Firebase App Hosting if:**

- You are using a supported full-stack framework like Next.js or Angular.
- You need Server-Side Rendering (SSR) or ISR.
- You want an automated "git push to deploy" workflow with zero configuration.

## Deploying to App Hosting

### Deploy from Source

This is the recommended flow for most users.

1. Configure `firebase.json` with an `apphosting` block.
   ```json
   {
     "apphosting": {
       "backendId": "my-app-id",
       "rootDir": "/",
       "ignore": [
         "node_modules",
         ".git",
         "firebase-debug.log",
         "firebase-debug.*.log",
         "functions"
       ]
     }
   }
   ```
1. Create or edit `apphosting.yaml`- see
   [Configuration](references/configuration.md) for more information on how to
   do so.
1. If the app needs safe access to sensitive keys, use
   `npx -y firebase-tools@latest apphosting:secrets` commands to set and grant
   access to secrets.
1. Run `npx -y firebase-tools@latest deploy` when you are ready to deploy.

### Deploy via Local Builds (Experimental)

If you want faster deployments by bypassing Cloud Build queues, you can compile your full-stack web application locally.
1. Set up the experiments and configure `"localBuild": true` in your `firebase.json` file.
2. Run `npx -y firebase-tools@latest deploy --only apphosting` to compile and deploy the pre-built assets.

> [!CAUTION]
> **SECURITY WARNING FOR CODING AGENTS (AI ASSISTANTS):**
> - **DO NOT** bypass confirmation using `--allow-local-build-secrets` unless explicitly requested by the developer.
> - **PAUSE AND WARN** the developer of the severe risk that raw secret values will be downloaded locally and may get permanently compiled into public client-side bundles or cached artifacts.
> - Review the strict operating system, framework, and security limitations in the [Local Builds Reference](references/local_builds.md).

### Automated deployment via GitHub (CI/CD)

Alternatively, set up a backend connected to a GitHub repository for automated
deployments "git push" deployments. This is only recommended for more advanced
users, and is not required to use App Hosting. See
[CLI Commands](references/cli_commands.md) for more information on how to set
this up using CLI commands.

## Runtimes & Automatic Base Image Updates (ABIU)

App Hosting supports versioned Node.js runtimes with Automatic Base Image Updates (ABIU) to apply security patches without redeploys.
- **CRITICAL**: AI Assistants **MUST** inspect the project's `package.json` and check the `engines.node` field before recommending a runtime version or creating a backend. Mismatched runtimes trigger build-time errors.
- For a complete guide on setup, CLI flags, and lifecycle management, see [Runtimes & ABIU](references/runtimes_and_abiu.md).

## Emulation

See [Emulation](references/emulation.md) for more information on how to test
your app locally using the Firebase Local Emulator Suite.
