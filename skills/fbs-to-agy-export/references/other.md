# Generic Project Build

This guide provides instructions for investigating, building, and previewing projects of unknown types (non-Next.js).

## 1. Warn User and Ask for Permission

> [!WARNING]
> **Mandatory Step**: YOU MUST ask the user for permission before starting any extensive investigation because blind detective work on an unknown codebase can consume large amounts of tokens very quickly. **DO NOT proceed with any file reading or scanning until you have explicit user consent.**

> [!IMPORTANT]
> **Planning Requirement**: YOU MUST include this permission request and the conditional branching in your implementation plan or task list. Verify user consent before executing any investigation commands.

**Action**: Prompt the user with exactly this warning: "The project type is recognized as '<FBS_PROJECT_TYPE>', which requires manual investigation. This detective work can take a long time and consume significant tokens. Do you authorize me to proceed with investigating the project to find a way to build and preview it?"

*   **If user agrees**: Immediately proceed to the next step (**2. Detective Work: Gather Information**).
*   **If user disagrees**: Stop here and notify the user that they will need to manually build and verify the project.

## 2. Detective Work: Gather Information

If the user agrees, perform the following investigation to determine how to build and preview the project.

### 2.1. Check `.idx/dev.nix`
Look for clues about the project type and how to launch a preview.
*   **Action**: Read `<TARGET_FOLDER>/.idx/dev.nix`.
*   **Look for**:
    *   `previews.web.command` or similar preview configurations.
    *   Dependencies or packages that indicate the framework (e.g., `pkgs.nodePackages.npm`, `pkgs.python3`).

### 2.2. Check other files under `.idx/`
Look for clues about the project type, how to build and how to launch a preview.
*   **Action**: Read `<TARGET_FOLDER>/.idx/`.
*   **Look for**:
    *   `previews.web.command` or similar preview configurations.
    *   Dependencies or packages that indicate the framework (e.g., `pkgs.nodePackages.npm`, `pkgs.python3`).

### 2.3. Scan Project for Language/Framework
If `.idx` files do not provide enough information, scan the project files to identify the language or framework.
*   **Action**: List the root directory of the project.
*   **Action**: Look for common configuration files:
    *   `package.json` (Node.js/JavaScript/TypeScript)
    *   `requirements.txt`, `Pipfile`, `pyproject.toml` (Python)
    *   `Gemfile` (Ruby)
    *   `pom.xml`, `build.gradle` (Java)
    *   `go.mod` (Go)
    *   `Cargo.toml` (Rust)
*   **Action**: Use `grep_search` to search for common framework imports or keywords if necessary.

## 3. Formulate Build and Preview Plan

Based on the gathered information, determine the likely build and preview commands.

*   **Prioritize Web Preview**: Always prioritize a web preview if available or feasible for the project type.

## 4. Execute Build and Preview

1.  **Ensure CLI Tools are Installed**: Make sure all required CLI tools (e.g., `python`, `ng`, etc.) are available.
    *   **Prioritize Node tools**: Prioritize using `npx` or `npm` since Node is guaranteed to be installed.
    *   **Fallback to Install**: If a required CLI is missing, attempt to install it automatically for the user or prompt the user for manual installation.
    *   **Consent Required**: Always ask for user consent before installing any CLI tool.
2.  **Install Dependencies**: Run the appropriate dependency installation command (e.g., `npm install`, `pip install -r requirements.txt`).
3.  **Build Application**: Run the build command if necessary (e.g., `npm run build`).
