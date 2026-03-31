# 🛠️ Firebase Android Setup Guide

---
## 📋 Prerequisites
Before running these commands, ensure you are authenticated:
` firebase login` (or `firebase login --no-localhost` on remote servers)
---

## 1. Create a Firebase Project
If you haven't already created a project, create a new cloud project with a unique ID:
` firebase projects:create <UNIQUE_PROJECT_ID> --display-name '<DISPLAY_NAME>'`
*Example:*
` firebase projects:create my-cool-app-vguthal-20260330 --display-name 'MyCoolApp'`
### 2. Register Your Android App
Link your Android app module (package name) to your project. Notice that the display name is passed as a positional argument at the end:
` firebase apps:create ANDROID '<APP_DISPLAY_NAME>' --package-name '<PACKAGE_NAME>' --project <PROJECT_ID>`
*Example:*
` firebase apps:create ANDROID 'MyApplication' --package-name 'com.example.myapplication' --project my-cool-app-vguthal-2b`
### 3. Download `google-services.json`
Fetch the configuration file using the App ID (which is printed in the output of the previous command):
` firebase apps:sdkconfig ANDROID <APP_ID> --project <PROJECT_ID>`
*Example output extraction to file:*
` # (Output must be saved as app/google-services.json)`
---
## ✅ Verification Plan
### Manual Verification
Validate that the project was created and registered successfully:
` firebase projects:list`
` firebase apps:list --project <PROJECT_ID>`

---
## 🤖 AI Automation Workflow

If you are working with an AI agent (like Antigravity), you can ask it to automate these steps for you!

**Usage:** Ask the agent to create the app and pass the display name.

**Example Prompt:**
"Create a Firebase app for this project. Use your own unique project ID and ask me for the display name."

The agent will:
1. Generate a unique project ID.
2. Ask you for the app display name.
3. Automatically run the CLI commands to:
    - Create the project.
    - Register the app.
    - Download `google-services.json` to the correct location.