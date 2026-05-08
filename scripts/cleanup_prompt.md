# Cleanup Prompt for Android Skills

Use this prompt with an LLM to clean up markdown files after running `generate_android_skills.js`. The script removes files and links, but may leave sentence fragments or empty sections.

## Prompt

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
