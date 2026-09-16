---
name: deploy-cloud-run
description: A skill to deploy a web application to Cloud Run. Use this when you need to deploy a web application to Cloud Run.
---

# Deploy Application to Cloud Run

When asked to deploy the application to Cloud Run, follow these instructions:

1. **Prerequisites**: Ensure you are in the root directory of the web application.
  - You'll need to ensure that billing is enabled. To check if billing is enabled and attach a billing account (if you have one) use the "add-billing" skill.
2. **Prepare Deployment Assets**: Before running the deployment command, copy the `Dockerfile` provided in this skill's `resources/` directory into the root of the web application.
3. **Deployment Command**: Use the `gcloud run deploy` command to deploy directly from source.
4. **Arguments**:
   - `--source .`: Use the current directory as the source for the build.
   - `--allow-unauthenticated`: Ensure the deployed app is publicly viewable by third parties.
   - Supply a `SERVICE_NAME` and `REGION` (e.g., `us-central1`), picking sensible defaults if none are provided.
5. **Cleanup**: After the deployment completes (successfully or not), **delete** the `Dockerfile` from the web application's root directory to keep the source tree clean.

**Example Command Sequence**:
```bash
cp .agents/plugins/firebase-antigravity-plugin/skills/deploy-cloud-run/resources/Dockerfile ./Dockerfile
gcloud run deploy my-web-app --source . --region us-central1 --allow-unauthenticated
rm ./Dockerfile
```