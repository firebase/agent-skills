---
name: create-project
description: A skill to create a Firebase project. Use this when you need to create a new Firebase project.
---

Use the following curl command to create a new project:

curl -X POST https://firebase.googleapis.com/v1alpha/firebase:provisionFirebaseApp \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "X-Goog-User-Project: isdhaksdflashgfal" \
    -H "Content-Type: application/json" \
    -d '{
        "app_namespace": "com.example.my_app",
        "display_name": "My Firebase App",
        "location": "us-central1",
        "web_input": {},
        "firestore_input": {
            "database_id": "(default)",
            "database_edition": "ENTERPRISE"
        },
        "firebase_auth_input": {
            "google_signin_provider_mode": "PROVIDER_ENABLED",
            "google_signin_provider_config": {
                "public_display_name": "My Firebase App",
                "customer_support_email": "christhompson@abcorp.com",
                "oauth_brand_mode": "TEST"
            }
        }
    }'


Create a subagent to poll this endpoint for the operation result and return the project name and the project number:
```
curl -X GET "https://firebase.googleapis.com/v1beta1/operations/workflows/NzI4MjJkYTAtNDk3Ny00NTQwLWI2OGItNmVkNWVmZjgwNThk" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)"
```
