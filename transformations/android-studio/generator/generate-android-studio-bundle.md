# Generating Android Studio Skills

This guide covers the process of generating a limited version of Firebase skills for Android Studio. The generated content lives in the `transformations/android-studio/skills/` directory on the `main` branch.

## Instructions for the Operator (Human or AI)

Follow these steps to regenerate the bundle:

### 1. Run the Generation Script
Run the following command from the root of the repository:
```bash
node transformations/android-studio/generator/generate_android_skills.js
```
This will create or update the directory `transformations/android-studio/skills/` with the filtered skills.

### 2. Clean Up Content with LLM
Use the following prompt with an LLM to clean up the markdown files in `transformations/android-studio/skills/` to remove dangling references and fix grammar.

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

Apply this to all `.md` files in `transformations/android-studio/skills/` that need cleanup (especially `SKILL.md` files).

### 3. Commit and Push
Commit the changes to your working branch and push them.
```bash
git add transformations/android-studio/skills/
git commit -m "Update Android Studio skills"
git push
```

---
Note: The script `generate_android_skills.js` and this guide live in `transformations/android-studio/generator/`. The generated content lives in `transformations/android-studio/skills/`.
