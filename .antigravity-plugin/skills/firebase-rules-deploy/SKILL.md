---
name: firebase-rules-deploy
description: A skill to deploy Firestore rules. Use this when you need to deploy Firestore rules.
---

# Deploy Firestore Rules

Prior to deploying rules we need to make sure our gcloud email and firebase email match. If not use the following:

`firebase login` will print the currently logged in and selected account.
`gcloud config get-value account` similarly will print the currently logged in account.

Use `firebase deploy --only firestore:rules --project=<project_id>`. All other deployments should use the `gcloud` CLI.