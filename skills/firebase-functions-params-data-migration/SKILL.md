---
name: firebase-functions-params-data-migration
description: Migrate data from functions.config() to Firebase Functions Params (.env files and Cloud Secret Manager)
version: 0.0.1
---

# Firebase Functions Params Data Migration

## Context
The user wants to move their configuration data from the deprecated `functions.config()` (Runtime Config) to the modern `firebase-functions/params` storage mechanisms (e.g., `.env` files, Cloud Secret Manager).
This skill should be run after `firebase-functions-params-refactor` or whenever someone says they want to move their data from `functions.config()` to params.

## Triggers
Activate this skill when:
1. The user asks to "move data from config", "migrate functions config values", or "setup .env files for params".
2. Offered as a completion step to `firebase-functions-params-refactor`.

## Prerequisites
- All `functions.config()` calls must be removed from the codebase.
- If this is not done, suggest running `firebase-functions-params-refactor` first to rewrite their code to use params.

## Steps

### 1. Extract Existing Configuration
Print out all of the current `functions.config()` storage with:
```bash
firebase functions:config:get --project [projectId]
```

Review the JSON output and map the keys to the new functions params defined in the codebase.

### 2. Secret Mapping
For any config value that maps to a `defineSecret()` param:

1. Check to see whether the secret exists with the same value by accessing it:
   ```bash
   firebase functions:secrets:access [SECRET_NAME]
   ```
2. If the secret does not exist, set the secret environment variable:
   ```bash
   firebase functions:secrets:set [SECRET_NAME]
   ```
3. If it exists with the same value, continue.
4. If it exists with a different value, prompt the user how to continue.

### 3. Determine Config Scope
Figure out whether the customer wants project-specific or global configs.
Customers can specify that some config is global and some is project-specific.

### 4. Populate Environment Files
Based on the scope determined in Step 3:

- For any **global** config, put the value in a `.env` file.
- For any **project-specific** config, put it in `.env.[projectId]`.

### 5. Emulator Support (Local Config)
If the Firebase Emulator Suite is installed, help the user set up local configuration.

1. Ask the user what values they want for either secrets or project-specific config in the local environment.
2. **Non-secret values** should be placed in `.env.local`. These can be checked into source control.
3. Any **sensitive/secret values** should be placed in `.secrets.local`.
4. **IMPORTANT**: Ensure that `.secrets.local` is added to `.gitignore`.
