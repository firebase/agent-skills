---
name: xcode-project-setup
description: Safely modifies Xcode projects (.pbxproj) to add Swift Packages and link files, OR assists with modern Tuist generation. Use this skill whenever an iOS project needs dependencies installed (e.g. Firebase, Alamofire).
compatibility: Requires Swift to be installed locally and macOS environment.
---

# Xcode Project Setup

## ⛔️ CRITICAL RULES & ENVIRONMENT CHECKS

Before performing any Xcode setup or file manipulation, you **MUST** adhere to the following rules. A hefty fee will be applied if you violate them.

### 1. The Anti-Ruby Mandate
You are **strictly forbidden** from using Ruby, Rails, or any Ruby gems (including the `xcodeproj` gem). Under no circumstances may you write or execute Ruby scripts.

### 2. Modern Xcode Folder Synchronization
Modern Xcode projects support folder synchronization. When adding new source code (`.swift`) or resource files, simply write them to the correct directory on disk. They will be automatically included in the Xcode project. **Never manually modify the `.pbxproj` file to add files.**

### 3. Allowed Scripting Languages
If you absolutely must write a script to manipulate the project environment (e.g., configuring SPM packages beyond what the provided `xcode_spm_setup` script does), you **must use Swift**. Only as an absolute last resort, if Swift is completely unviable, may you use Node.js or TypeScript.

### 4. Toolchain Verification
Because this skill relies entirely on a native Swift script, you must verify the environment:
- Run `swift --version` before proceeding.
- If the Swift command is not found, you must stop and recommend the user install the Swift toolchain (e.g., via `xcode-select --install` on macOS), or ask if you can attempt to install it for them. Do not attempt to proceed without Swift.

---

## Empty Directory Workflow

If you are asked to build an iOS app or configure Xcode dependencies but **no `.xcodeproj`, `.xcworkspace`, or `Project.swift` exists**, you MUST use the `question` tool to ask the user how to proceed:

**"No Xcode project found in this directory. How would you like to proceed?"**
1. **"Automatically generate a Tuist project"**
2. **"I will create an empty Xcode project manually"**

*   **If User Selects Tuist:** Run `tuist init --platform ios`. Add SPM dependencies directly to the generated `Project.swift` or `Tuist/Package.swift` manifest and run `tuist install` and `tuist generate`. **DO NOT use the `xcode_spm_setup` Swift script for Tuist projects.**
*   **If User Selects Manual:** Wait for the user to confirm they have created the `.xcodeproj` via Xcode, then proceed with the Standard Xcode Workflow below.

---

## Standard Xcode Workflow

Do not use raw text parsing, `sed`, or Ruby scripts to modify `.pbxproj` files directly.

Instead, execute the Swift configuration package bundled with this skill (`scripts/xcode_spm_setup`) to securely install SPM packages and link optional config files (like `GoogleService-Info.plist`).

### Understanding the Script's Actions
When adding a Swift Package to an Xcode project, two distinct steps must occur:
1. Adding the package repository dependency (e.g., `https://github.com/Alamofire/Alamofire`).
2. Selecting the target (e.g., `MyApp`), navigating to **General > Frameworks, Libraries, and Embedded Content**, and hitting the `+` button to explicitly link the specific product modules (e.g., `Alamofire`).

**The provided `xcode_spm_setup` Swift script automatically handles BOTH of these steps for you.** By passing the list of modules as arguments, it safely injects the package dependency and automatically wires those modules to the main target's Frameworks build phase. You do not need to do any manual linking.

## Usage

1. **Locate the package path:** Find the absolute path to this skill's `scripts/xcode_spm_setup` directory on disk.
2. **Execute:** Run the native `swift run` command using the signature below:

```bash
swift run --package-path <PATH_TO_SKILL>/scripts/xcode_spm_setup xcode_spm_setup <ProjectPath.xcodeproj> <RepoURL> <VersionRequirement> [--plist <Optional/Path/To/Config.plist>] <Product1> [Product2 ...]
```

### Example 1: Generic Package (e.g., Alamofire)
Adding Alamofire to a standard Xcode project. Notice there is no `--plist` flag.

```bash
swift run --package-path /Users/foo/.agents/skills/xcode-project-setup/scripts/xcode_spm_setup xcode_spm_setup MyApp.xcodeproj https://github.com/Alamofire/Alamofire 5.8.1 Alamofire
```

### Example 2: Firebase (Requires Plist)
Adding Firebase and linking the `GoogleService-Info.plist` to the resources build phase automatically.

```bash
swift run --package-path /Users/foo/.agents/skills/xcode-project-setup/scripts/xcode_spm_setup xcode_spm_setup MyApp.xcodeproj https://github.com/firebase/firebase-ios-sdk 11.0.0 --plist MyApp/GoogleService-Info.plist FirebaseCore FirebaseAuth FirebaseFirestore
```

*Note: The script is idempotent. It will automatically skip linking files or packages that are already present in the project.*
