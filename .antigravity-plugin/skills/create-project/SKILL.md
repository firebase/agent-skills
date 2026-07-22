Use the following curl command to create a new project:

```
curl -X POST https://firebase.googleapis.com/v1alpha/firebase:provisionFirebaseApp \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "X-Goog-User-Project: ctfdc1" \
    -H "Content-Type: application/json" \
    -d '{
        "app_namespace": "com.example.my_app",
        "display_name": "My Firebase App",
        "location": "us-central1",
        "web_input": {}
    }'
```

Listen on the operations endpoint for the result:
```
curl -X GET "https://firebase.googleapis.com/v1beta1/operations/workflows/ZDBiYzVmMGEtNjdiNS00ODA5LTk5MDktMDhmYWZjZDY1Zjcx" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)"
```
