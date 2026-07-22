The plugin is just dropped in a folder - so the easiest way is to symlink the working source from your app folder like so:

`ln -s ~/firebase/agent-skills/.antigravity-plugin ~/myappdirectory/.agents/plugins/firebase-antigravity-plugin`

Pre-flight checks:
- ensure you're not using corp - this prevents new project creation (you'll get a 401)
  - `gcloud config set account christhompsonfirebase@gmail.com`
- Login for ADC (if you continue to get 401 ensure you check the boxes on login)
  - `gcloud auth application-default login`

FIXME: move this into a tool of some kind, create a project and app.
```
curl -X POST "https://cloudresourcemanager.googleapis.com/v1/projects" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "agyplugintestproject1",
    "name": "agyplugintestproject1"
  }'
```

```
curl -X POST "https://firebase.googleapis.com/v1beta1/projects/agyplugintestproject1:addFirebase" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "us-central"
  }'
```

Since the creation of Firebase resources happens asynchronously, you can poll and monitor the creation progress by querying the returned operation name

```
curl -X GET "https://firebase.googleapis.com/v1beta1/operations/workflows/ZDBiYzVmMGEtNjdiNS00ODA5LTk5MDktMDhmYWZjZDY1Zjcx" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)"
```

Create web app:
```
curl -X POST "https://firebase.googleapis.com/v1beta1/projects/agyplugintestproject1/webApps" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "agy-plugin-web-app-1"
  }'
```

Get the app ID:
```
curl -s -X GET "https://firebase.googleapis.com/v1beta1/projects/agyplugintestproject1/webApps" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" | \
  jq '.apps[]? | select(.displayName == "agy-plugin-web-app-1")'
```

enable google signin provider for firebase auth:
```
curl -X POST "https://identitytoolkit.googleapis.com/admin/v2/projects/your-unique-project-id/defaultSupportedIdpConfigs?idpId=google.com" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "clientId": "YOUR_GOOGLE_OAUTH_CLIENT_ID",
    "clientSecret": "YOUR_GOOGLE_OAUTH_CLIENT_SECRET"
  }'

```

TODO provisioning API call k