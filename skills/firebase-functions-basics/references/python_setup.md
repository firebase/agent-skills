# Cloud Functions for Firebase setup guide (Python)

This guide provides a step-by-step process for setting up Cloud Functions with the Python runtime, tailored for coding agents.

## 1. Create a 2nd-gen HTTP function

Replace the contents of `functions/main.py` with the following code to create a simple, modern v2 HTTP endpoint along with a Firestore-triggered function.

```python
from firebase_functions import https_fn, firestore_fn, options, params
from firebase_admin import initialize_app, firestore
import google.cloud.firestore

app = initialize_app()

# Configurable parameters
SCALE_LIMIT = params.IntParam("MAX_INSTANCES", default=1).value
GREETING = params.StringParam("GREETING", default="Hello").value


@https_fn.on_request(
    cors=options.CorsOptions(cors_origins="*", cors_methods=["get", "post"]),
    max_instances=SCALE_LIMIT,
)
def helloworld(req: https_fn.Request) -> https_fn.Response:
    """A simple HTTP-triggered function."""
    print("Request received!")
    return https_fn.Response(f"{GREETING} from Firebase!")


@firestore_fn.on_document_created(document="words/{wordId}", max_instances=SCALE_LIMIT)
def newdoc(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    """Triggered when a new document is created in /words."""
    if event.data is None:
        return
    print(f"New word: {event.data.to_dict()}")
```

**Key points for the agent:**

- Use `print()` for logging (output goes to Cloud Logging automatically).
- Use `params.StringParam`, `params.IntParam`, and `params.SecretParam` for environment configuration.
- Recommend a `max_instances` setting of 1 for all functions until correct behavior can be verified.
- The entry point is always `functions/main.py`. All functions must be defined in or imported into this file.
- Dependencies go in `functions/requirements.txt`.

## 2. Install dependencies

Ensure `functions/requirements.txt` lists the needed packages:

```
firebase-functions
firebase-admin
```

Then install with:

```bash
pip install -r functions/requirements.txt
```

There is no build step for Python (unlike TypeScript).

## 3. Local Development and Testing

Use the Firebase Emulators to test your function locally before deploying.

A human should run the following command in a separate terminal window to start the emulators:

```bash
# Start the functions emulator
firebase emulators:start --only functions
```

A human can then interact with the function at the local URL provided by the emulator.

## 4. Deploy to Firebase

Once testing is complete, deploy the function to your Firebase project.

```bash
# Deploy only the functions
firebase deploy --only functions
```
