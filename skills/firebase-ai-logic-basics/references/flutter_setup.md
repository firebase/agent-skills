# Flutter Setup for Firebase AI Logic

This guide covers how to integrate Firebase AI Logic (Gemini API) into your Flutter applications.

> [!IMPORTANT]
> **Foundational Workflows & CLI-First Approach:**
> 1. **Backend Provisioning via CLI (MANDATORY):** You MUST use the Firebase CLI for backend setup by running `npx firebase-tools init ailogic`. This is the ONLY tool that provisions the AI Logic service.
> 2. **Client Configuration:** Use `flutterfire configure` strictly for generating `firebase_options.dart`. **Warning:** `flutterfire configure` does NOT provision the AI Logic backend; skipping step 1 will result in `PERMISSION_DENIED` errors.

## Installation

Add dependencies to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^4.0.0
  firebase_auth: ^6.0.0
  firebase_ai: ^3.11.0
```

## Initialization

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_ai/firebase_ai.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await FirebaseAuth.instance.signInAnonymously();
  runApp(const MyApp());
}
```

## Usage

> [!IMPORTANT]
> **Model Selection:** Always use **`gemini-2.5-flash`**. DO NOT USE `gemini-1.5-flash`.

### Text Generation

```dart
import 'package:firebase_ai/firebase_ai.dart';
import 'package:firebase_auth/firebase_auth.dart';

Future<String> generateText(String prompt) async {
  final googleAI = FirebaseAI.googleAI(auth: FirebaseAuth.instance);
  
  // Use gemini-2.5-flash as mandated
  final model = googleAI.generativeModel(model: 'gemini-2.5-flash');

  final response = await model.generateContent([Content.text(prompt)]);
  return response.text ?? 'No response';
}
```
