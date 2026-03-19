# Next.js Build

Validate that the exported project compiles correctly. Run these commands sequentially to ensure all dependencies are met before typechecking and building.

## Prerequisites

*   Node.js is installed and available in the system PATH.
    * Check version by running `node --version`.
    * If not installed, instruct the user to install it.

## 1. Set Working Directory
Navigate to the root directory of the Next.js project so commands run in the correct context.
```bash
cd <TARGET_FOLDER>
```

## 2. Install Dependencies
Download and install the required Next.js React packages to `node_modules` to ensure the project has all its necessary libraries.
```bash
npm install
```

## 3. Typecheck Code
Run TypeScript static analysis to verify code quality and identify potential type errors before attempting a full build.
```bash
npm run typecheck
```
*(Fallback: If this script is missing from `package.json`, use `npx -y tsc --noEmit` instead.)*

## 4. Build Web Application
Compile the Next.js application to ensure there are no build-time errors.
```bash
npm run build
```

## Verification and Troubleshooting

*   **Verification**: The `npm run build` command should successfully complete without errors, confirming the project is syntactically correct and can be built.
*   **Error Handling**:
    *   **Dependency Errors**: If `npm install` fails, examine `package.json` for invalid versions or conflicts.
    *   **Type Errors**: If `npm run typecheck` fails, there may be TypeScript issues in the codebase. Inform the user and see if they want you to attempt to fix them.
    *   **Build Failures**: If `npm run build` fails, analyze the error output to distinguish between application bugs and environment configuration issues.
