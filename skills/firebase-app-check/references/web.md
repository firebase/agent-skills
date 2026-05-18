# Web App Check Setup

Cheatsheet for setting up App Check on Web.

## Providers
- **reCAPTCHA v3**: Good for most web apps.
- **reCAPTCHA Enterprise**: For enterprise needs, more advanced features.

## Setup Steps

1.  **Firebase Console**:
    - Navigate to **Security > App Check**.
    - Register your app with **reCAPTCHA v3** or **reCAPTCHA Enterprise**.
    - You will need to provide a site key. If you don't have one, you can create it in the reCAPTCHA console.
2.  **Add SDK**:
    - Include the App Check SDK in your web app.
3.  **Initialization**:
    - Initialize App Check *before* using other Firebase services.

### JS Example (Modular SDK)

```javascript
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  // ...
};

const app = initializeApp(firebaseConfig);

// Pass your reCAPTCHA v3 site key to the provider
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('your-recaptcha-v3-site-key'),
  isTokenAutoRefreshEnabled: true // Set to true to allow auto-refresh
});
```

## Gotchas
- reCAPTCHA v3 has a monthly quota of 1M free verifications.
- reCAPTCHA Enterprise has a free tier of 10,000 assessments per month.
- Ensure your authorized domains are correctly configured in the reCAPTCHA console.
