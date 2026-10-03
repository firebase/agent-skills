---
name: add-billing
description: A skill to add billing to a Firebase project. Use this when you need to add billing to a Firebase project (e.g. before deploying a Cloud Run app).
---

`gcloud billing accounts list`

If no results, you'll need to create a billing account. Forward them to the console to create a billing account:
https://console.firebase.google.com/u/3/project/<projectId>

`gcloud billing accounts list` may take 10 seconds to update with the billing account.

Then, 

`gcloud beta billing projects link <projectId> --billing-account=<accountId>`

gcloud beta billing projects link com-example-noteapp-f9b56 --billing-account=013F6F-47D260-E203AC
