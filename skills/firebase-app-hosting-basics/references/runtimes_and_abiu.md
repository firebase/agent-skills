# App Hosting Runtimes & Automatic Base Image Updates (ABIU)

Firebase App Hosting allows you to choose a specific runtime environment (e.g., versioned Node.js) for your backend. When you choose a versioned runtime, **Automatic Base Image Updates (ABIU)** automatically applies security patches to your underlying OS/runtime container without requiring you to rebuild or redeploy.

---

## Mandatory Rules for Coding Agents

> [!IMPORTANT]
> **CRITICAL RUNTIME COMPATIBILITY INSTRUCTION FOR CODING AGENTS (AI ASSISTANTS):**
> 1. **Inspect package.json first**: Before recommending a runtime version or running backend creation commands, you **MUST** read the user's `package.json` file and inspect the `engines.node` field (e.g., if `"engines": { "node": ">=22.0.0" }` is specified, you must select `nodejs22` or `nodejs24`).
> 2. **Prevent mismatch failures**: Creating a backend with a runtime version that is incompatible with the `engines` field will trigger a build failure during the Cloud Build phase.
> 3. **Warn on default runtime**: If the default unversioned `nodejs` runtime is used, warn the developer that ABIU is completely disabled (leaving their container without automated security updates) and recommend migrating to a versioned runtime (e.g. `nodejs22`).

---

## Setup and Configuration

### 1. Enable runtime Selection
Ensure the `abiu` experiment is enabled on the local CLI:
```bash
npx -y firebase-tools@latest experiments:enable abiu
```

### 2. Specifying runtime During Backend Creation
When creating a new backend programmatically or in non-interactive environments, specify the target versioned runtime using the `--runtime` flag:
```bash
npx -y firebase-tools@latest apphosting:backends:create --runtime nodejs22 --backend my-backend-name --primary-region us-central1
```

---

## Runtime Lifecycles & Support

Runtimes progress through the following lifecycle phases (mirroring Cloud Run's support):

| Lifecycle State | Description | Agent Actions |
| :--- | :--- | :--- |
| **Supported** | Fully supported. ABIU security patches are active. | Recommend these versions to users. |
| **Deprecated** | Approaching end of support. Existing apps continue running, but warnings appear in the Console. | Warn the user to migrate to a newer version as soon as possible. |
| **Decommissioned** | Completely unsupported. New builds or backends using this version will fail with errors. Existing containers may stop working or be deleted. | **NEVER** allow creation of new backends on decommissioned versions. Assist the user in upgrading. |
