# Creating a Project and App

## 1. Create a Firebase Project
To create a new Firebase project from the CLI:

```bash
npx -y firebase-tools@latest projects:create
```

You will be prompted to:
1. Enter a **Project ID** (must be 6-30 chars, lowercase, digits, and hyphens; must be unique globally).
2. Enter a **display name**.

## 2. Register Platform-Specific Apps
A Firebase Project is just a container. To actually use Firebase in code, you must register a platform-specific "App" (iOS, Android, or Web) within the Firebase project and download its configuration file so that it can be added to the codebase.

**Generic App Creation Command:**
```bash
npx -y firebase-tools@latest apps:create <IOS|ANDROID|WEB> <package-name-or-bundle-id>
```

**Generic Config Download Command:**
```bash
npx -y firebase-tools@latest apps:sdkconfig <IOS|ANDROID|WEB> <App-ID>
```

### ➡️ Next Steps for Agents
Do NOT guess the configuration steps. You **MUST** refer to the specific setup guide for your target platform to see exactly how to download and integrate the config files:
- For iOS: Refer to `ios_setup.md`
- For Web: Refer to `web_setup.md`