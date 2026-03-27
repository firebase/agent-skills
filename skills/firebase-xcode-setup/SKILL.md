---
name: firebase-xcode-setup
description: Safely modifies Xcode projects (.pbxproj) to add Firebase SPM packages and link the GoogleService-Info.plist file. Use this skill whenever an iOS project needs Firebase dependencies installed.
compatibility: Requires Swift to be installed locally and macOS environment.
---

# Firebase Xcode Setup

## ⛔️ CRITICAL RULES & ENVIRONMENT CHECKS

Before performing any Xcode setup or file manipulation, you **MUST** adhere to the following rules. A hefty fee will be applied if you violate them.

### 1. The Anti-Ruby Mandate
You are **strictly forbidden** from using Ruby, Rails, or any Ruby gems (including the `xcodeproj` gem). Under no circumstances may you write or execute Ruby scripts.

### 2. Modern Xcode Folder Synchronization
Modern Xcode projects support folder synchronization. When adding new source code (`.swift`) or resource files, simply write them to the correct directory on disk. They will be automatically included in the Xcode project. **Never manually modify the `.pbxproj` file to add files.**

### 3. Allowed Scripting Languages
If you absolutely must write a script to manipulate the project environment (e.g., configuring SPM packages beyond what the provided `firebase_xcode_setup` script does), you **must use Swift**. Only as an absolute last resort, if Swift is completely unviable, may you use Node.js or TypeScript.

### 4. Toolchain Verification
Because this skill relies entirely on a native Swift script, you must verify the environment:
- Run `swift --version` before proceeding.
- If the Swift command is not found, you must stop and recommend the user install the Swift toolchain (e.g., via `xcode-select --install` on macOS), or ask if you can attempt to install it for them. Do not attempt to proceed without Swift.

---

## Instructions

Do not use raw text parsing, `sed`, or Ruby scripts to modify `.pbxproj` files directly.

Instead, execute the Swift configuration package bundled with this skill (`scripts/firebase_xcode_setup`) to securely install SPM packages and link the `GoogleService-Info.plist` file.

### Understanding the Script's Actions
When adding a Swift Package to an Xcode project, two distinct steps must occur:
1. Adding the package repository dependency (e.g., `firebase-ios-sdk`).
2. Selecting the target (e.g., `MyApp`), navigating to **General > Frameworks, Libraries, and Embedded Content**, and hitting the `+` button to explicitly link the specific product modules (e.g., `FirebaseAuth`, `FirebaseFirestore`).

**The provided `firebase_xcode_setup` Swift script automatically handles BOTH of these steps for you.** By passing the list of modules as arguments, it safely injects the package dependency and automatically wires those modules to the main target's Frameworks build phase. You do not need to do any manual linking.

## Usage

1. **Locate the package path:** Find the absolute path to this skill's `scripts/firebase_xcode_setup` directory on disk.
2. **Determine your targets:** You will need the path to the user's `.xcodeproj` file, the path to their `GoogleService-Info.plist` file, and a list of Firebase products to install (e.g., `FirebaseCore`, `FirebaseAuth`, `FirebaseFirestore`).
3. **Execute:** Run the native `swift run` command:

```bash
swift run --package-path <PATH_TO_THIS_SKILL>/scripts/firebase_xcode_setup firebase_xcode_setup <Path/To/Project.xcodeproj> <Path/To/GoogleService-Info.plist> [FirebaseProduct1] [FirebaseProduct2] ...
```

### Example
If this skill is installed at `/Users/foo/.agents/skills/firebase-xcode-setup`, and you want to add `FirebaseCore`, `FirebaseAuth`, and `FirebaseFirestore`:

```bash
swift run --package-path /Users/foo/.agents/skills/firebase-xcode-setup/scripts/firebase_xcode_setup firebase_xcode_setup MyApp.xcodeproj MyApp/GoogleService-Info.plist FirebaseCore FirebaseAuth FirebaseFirestore
```

*Note: The script is idempotent. It will automatically skip linking files or packages that are already present in the project.*
