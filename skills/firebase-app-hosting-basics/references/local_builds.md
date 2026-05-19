# App Hosting Local Builds (Experimental)

App Hosting Local Builds is an experimental feature that compiles your full-stack web application (e.g. Next.js) on your local development machine instead of using Google Cloud Build in the cloud. Once compiled, the Firebase CLI packages the pre-built standalone assets and uploads them directly to Cloud Run.

This feature is highly useful for faster deployments, bypassing cloud build queue times, and debugging build outputs locally.

> [!WARNING]
> This is an early preview of prototype code and you are likely to encounter bugs. Do NOT use this with production backends or sensitive data. Only use test backends and non-sensitive test data as you evaluate this feature.

---

## Mandatory Rules for Coding Agents

> [!CAUTION]
> **CRITICAL SECURITY INSTRUCTION FOR CODING AGENTS (AI ASSISTANTS):**
> 1. **DO NOT** run local builds with the `--allow-local-build-secrets` flag unless the developer has explicitly instructed you to bypass confirmations for build secrets.
> 2. **PAUSE AND WARN** the user if you detect any `BUILD`-available secrets in `apphosting.yaml`. You must explain that:
>    - Local builds will download the raw, unencrypted secret values from Google Cloud Secret Manager to your local machine.
>    - These raw secret values can easily be permanently baked into your client-side JavaScript bundles (e.g. due to Next.js bundler behavior) or left behind in local build artifacts/temporary files.
> 3. **GET EXPLICIT APPROVAL** from the user before proceeding with a local build when secrets are configured.

---

## Setup and Configuration

### 1. Enable Experiments
Enable the required experimental CLI preview flags on your local machine:
```bash
npx -y firebase-tools@latest experiments:enable abiu
npx -y firebase-tools@latest experiments:enable apphostinglocalbuilds
```

> [!NOTE]
> The experiment `universalMaker` is no longer a separate experiment name in the Firebase CLI. All binary management and building capabilities are fully handled under the `apphostinglocalbuilds` experiment.

### 2. Configure `firebase.json`
To instruct the Firebase CLI to perform a local build during deploy, set `"localBuild": true` in the `apphosting` block of your `firebase.json`:

```json
{
  "apphosting": [
    {
      "backendId": "my-local-build-backend",
      "localBuild": true,
      "rootDir": "/",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "functions"
      ]
    }
  ]
}
```

---

## Technical Details (How It Works Under the Hood)

When you execute `npx -y firebase-tools@latest deploy --only apphosting`, the local build flow performs the following steps:

1. **Isolated Scratch Workspace**: The CLI creates a temporary scratch folder named `.local_build_<backendId>` in your project root and copies all project files into it. It applies your `firebase.json` ignore patterns and respects `.gitignore` to ensure a clean build context matching what would have been sent to Cloud Build.
2. **Secret Injection**: If your `apphosting.yaml` environment contains secrets marked for `BUILD` availability:
   - In interactive mode, the CLI will prompt you with a warning before downloading.
   - In non-interactive mode (e.g. CI scripts), the deployment will abort with an error unless the `--allow-local-build-secrets` flag is provided.
   - The CLI programmatically fetches the raw values from GCP Secret Manager and injects them into the local build process's `process.env`.
3. **Universal Maker Execution**: The CLI downloads the architecture-aware **Universal Maker** build engine binary (caching it at `~/.cache/firebase/universal-maker/`), verifies its size and SHA256 checksum, and executes it in the scratch folder to compile the application.
4. **Output Extraction**: The CLI parses the generated `build_output.json` and `.apphosting/bundle.yaml` to extract the application's start-up `runCommand` and stand-alone output files (e.g., `.next/standalone`).
5. **Tarball Compacting & GCS Upload**: The standalone output folder and configurations are compressed into an optimized `.tar.gz` tarball (ignoring unneeded source or `node_modules`), uploaded to GCS, and the `.local_build_<backendId>` directory is safely deleted.
6. **Rollout Deployment**: The App Hosting API is invoked with a `locallyBuilt` source payload containing the storage URL, start-up `runCommand`, and discovered environment variables.

---

## All Limitations & Warnings

Before adopting local builds, you must be aware of the following strict limitations:

### 1. Host Platform Restrictions
The pre-compiled Universal Maker build binary only supports a subset of operating systems and architectures:
- **macOS**: Only macOS Apple Silicon (`darwin_arm64`) is supported. macOS Intel (`darwin_x64`) is not supported.
- **Linux**: Only Linux x86-64 (`linux_x64`) is supported. Linux ARM (`linux_arm64`) is not supported.
- **Windows**: Windows (`win32`) is not supported. Windows developers must deploy from source or run the CLI inside a WSL (Windows Subsystem for Linux) environment.

### 2. Security & Secret Exposure Caveats
If your build depends on secrets marked for `BUILD` availability, the CLI fetches the raw, unencrypted values from Cloud Secret Manager and sets them as environment variables in the build context.
- **General Build-Time Risk**: Developers must be extremely cautious when using build-available secrets. Ensure your application code and build scripts do not accidentally expose or embed these sensitive values into client-side bundles, compiled files, or public assets. This risk is universal and is equally critical whether you compile locally or remotely on Google Cloud Build.

### 3. Local Directory Collisions & Artifact Leftovers
The local build pipeline creates intermediate workspace directories (such as `.local_build_<backendId>`) during the compilation process.
- **Interrupted Cleanup**: While the CLI is designed to automatically delete these intermediate folders upon a successful build, **if the build process is interrupted, force-quit, or crashes mid-execution, these artifacts may be left on your system**. You will need to manually delete these leftover directories to secure any cached environment variables and to prevent subsequent `firebase deploy` commands from blocking due to directory collisions.
