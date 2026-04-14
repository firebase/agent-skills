# Flutter Setup for Firebase AI Logic

This guide covers how to integrate Firebase AI Logic (Gemini API) into your Flutter applications.

> [!IMPORTANT]
> **Foundational Workflows & CLI-First Approach:**
> 1. **Review Foundation:** Before implementing platform-specific code, ALWAYS review the foundational `firebase-basics` skill to ensure familiarity with core workflows.
> 2. **Backend Provisioning via CLI:** Use the Firebase CLI for backend setup. Running `npx firebase-tools init ailogic` automatically enables the Gemini Developer API.
> 3. **Client Configuration:** Use `flutterfire configure` strictly for generating `firebase_options.dart`. Avoid manual Console configuration.

> [!NOTE]
> `firebase_vertexai` has been replaced by `firebase_ai`. Always use `firebase_ai` for new projects.

## Installation

Add the necessary Firebase dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^4.0.0
  firebase_auth: ^6.0.0
  firebase_ai: ^3.0.0
```

Run `flutter pub get` to install the packages.

## Initialization

Initialize Firebase and sign in (anonymously or via authenticated user) before using AI Logic.

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_ai/firebase_ai.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await FirebaseAuth.instance.signInAnonymously();
  runApp(const MyApp());
}
```

## Usage

Use `FirebaseAI.googleAI` for the Gemini Developer API.

### Text Generation

```dart
import 'package:firebase_ai/firebase_ai.dart';
import 'package:firebase_auth/firebase_auth.dart';

Future<String> generateText(String prompt) async {
  final googleAI = FirebaseAI.googleAI(auth: FirebaseAuth.instance);
  
  // Use gemini-2.5-flash or gemini-flash-latest
  final model = googleAI.generativeModel(model: 'gemini-2.5-flash');

  final response = await model.generateContent([Content.text(prompt)]);
  return response.text ?? 'No response';
}
```

### Chat Session

```dart
final chat = model.startChat(history: [
  Content.text('Hello, I am a user.'),
  Content.model([TextPart('Hello! How can I help you today?')]),
]);

final response = await chat.sendMessage(Content.text('What is CBT?'));
```
