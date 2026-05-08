# Generating Android Studio Skills Bundle

This guide covers the process of generating a limited version of Firebase skills for Android Studio and publishing them to the `platform/android-studio` branch.

## Instructions for the Operator (Human or AI)

Follow these steps to regenerate the bundle and update the branch:

### 1. Run the Generation Script
Run the following command from the root of the repository on the `main` branch:
```bash
node scripts/generate_android_skills.js
```
This will create a directory `android-skills/` with the filtered skills.

### 2. Clean Up Content with LLM
Use the following prompt with an LLM to clean up the markdown files in `android-skills/` to remove dangling references and fix grammar.

#### Prompt for LLM Cleanup
```text
You are an AI assistant helping to create a limited version of Firebase skills for Android Studio.
Your task is to clean up the provided markdown file to make it focused on Android and remove broken links or dangling text left by a filtering process.

Instructions:
1. Remove any remaining links to files that have been deleted (iOS, Web, Flutter specific files).
2. Remove lines, bullet points, or sections that are exclusively about iOS, Web, or Flutter if they are left empty or dangling after link removal.
3. Rewrite sentences that list multiple platforms to only include Android (and shared platforms like Unity if relevant), ensuring correct grammar.
4. Do NOT remove content that is generic or applicable to all platforms unless it is part of a broken list.
5. Ensure the remaining text is grammatically correct and flows naturally.

Here is the file content:
[Insert file content here]
```

Apply this to all `.md` files in `android-skills/` that need cleanup (especially `SKILL.md` files).

### 3. Prepare the Branch
1. Check out a new branch from `platform/android-studio` (or create it if it doesn't exist):
   ```bash
   git checkout platform/android-studio
   git checkout -b update-android-bundle
   ```
2. Replace the content of the `skills/` directory with the content of `android-skills/`:
   ```bash
   rm -rf skills/*
   cp -r android-skills/* skills/
   ```
3. Commit the changes:
   ```bash
   git add skills/
   git commit -m "Update Android Studio skills bundle"
   ```

### 4. Open a Pull Request
1. Push the branch:
   ```bash
   git push origin update-android-bundle
   ```
2. Open a Pull Request against the `platform/android-studio` branch.

---
Note: The script `generate_android_skills.js` and this guide live on the `main` branch. The generated content lives on the `platform/android-studio` branch in the `skills/` directory.
