# Deploy Application to Cloud Run

When asked to deploy the application to Cloud Run, follow these instructions:

1. **Prerequisites**: Ensure you are in the root directory of the web application.
2. **Deployment Command**: Use the `gcloud run deploy` command to deploy directly from source.
3. **Arguments**:
   - `--source .`: Use the current directory as the source for the build.
   - `--allow-unauthenticated`: Ensure the deployed app is publicly viewable by third parties.
   - Supply a `SERVICE_NAME` and `REGION` (e.g., `us-central1`), picking sensible defaults if none are provided.

**Example Command**:
```bash
gcloud run deploy my-web-app --source . --region us-central1 --allow-unauthenticated
```