# Flutter Build

This guide provides instructions for building and previewing a Flutter web application. It is designed to be easily parsed and executed by an automated agent.

## Execution Steps

### Prerequisites

*   **Ensure Flutter SDK is installed and available in the system PATH**. This is required to build and preview the Flutter web application.
    * Run `flutter --version` and `dart --version` to verify setup. 
    * If either command fails, stop and instruct the user to install the Flutter SDK before continuing, as the downstream tasks will fail without them.

### 1. Set Working Directory
Navigate to the root directory of the Flutter project so commands run in the correct context.
```bash
cd <TARGET_FOLDER>
```

### 2. Check Environment
Run `flutter doctor` to detect any system or environment issues before executing project-specific commands. Review the output to ensure the environment is correctly set up.
```bash
flutter doctor
```

### 3. Install Dependencies
Download and install the required packages.
```bash
flutter pub get
```

### 4. Analyze Code
Run static analysis to verify code quality and identify potential errors.
```bash
flutter analyze
```

### 5. Build Web Application
Compile the Flutter application for the web platform.
```bash
flutter build web
```

## Verification and Troubleshooting

*   **Verification**: The `flutter run --machine -d web-server` command (or the specific command found in `.idx/dev.nix`) should successfully launch and provide a local URL (e.g., `http://localhost:<port>`). Accessing this URL should display the application.
*   **Error Handling**:
    *   **Dependency Errors**: If `flutter pub get` fails, examine `pubspec.yaml` for invalid dependency definitions or syntax errors.
    *   **Build Failures**: If `flutter build web` fails, verify that your Flutter installation is up-to-date and supports web development (`flutter config --enable-web`).
    *   **Preview Issues**: If `flutter run` fails, ensure the requested port is available and that there are no network restrictions.
