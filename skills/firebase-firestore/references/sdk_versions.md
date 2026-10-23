# Firestore SDK Version Resolution & Upgrade Guide

Never guess or hardcode memorized SDK versions from training weights.

## 1. Modifying Code in an Existing Repo with a Pinned SDK

When editing application code in a repository that already has an older
Firestore SDK pinned:

1. Do **not** silently mutate the dependency manifest or lockfile during an
   unrelated feature or bugfix edit (unless the requested feature requires a
   newer SDK, such as Enterprise Pipelines or Vector Search).
1. Inspect the manifest file locally. If the pinned Firestore SDK is outdated or
   the codebase uses deprecated patterns (e.g., Web v8 `firebase.firestore()`,
   `enableIndexedDbPersistence`, Python positional `.where("a", "==", "b")`,
   Android `firebase-firestore-ktx`, iOS `FirebaseFirestoreSwift`), complete the
   user's task and append a 1-line offer at the end of your response:
   > *"Note: `<package>` is pinned to `<current_version>`. Reply **upgrade
   > firestore** if you want me to bump it to the latest stable version."*

## 2. Adding Firestore, Project Setup, or Explicit Upgrade Requests

Whenever adding Firestore dependencies, scaffolding a project, or fulfilling an
upgrade request:

1. Run the `curl` query from the table below to fetch the latest stable version
   directly from the package registry (do **not** search the filesystem if
   package manager CLIs like `npm`, `mvn`, `dotnet`, `composer`, `bundle`, or
   `pod` are not in `PATH`).
1. Edit the dependency manifest file (`package.json`, `requirements.txt`,
   `pyproject.toml`, `go.mod`, `pom.xml`, `build.gradle.kts`, `Podfile`,
   `Package.swift`, `*.csproj`, `composer.json`, `Gemfile`, or `pubspec.yaml`)
   to set the latest version. If the project manages versions via a BOM
   (`com.google.cloud:libraries-bom` or `com.google.firebase:firebase-bom`),
   update the BOM version rather than adding an explicit version override on the
   child dependency. In Flutter (`pubspec.yaml`), also update `firebase_core` to
   its latest stable version alongside `cloud_firestore` to avoid version solver
   conflicts.
1. **Lockfile sync**: If a lockfile exists (`package-lock.json`, `go.sum`,
   `composer.lock`, `Gemfile.lock`, `Podfile.lock`, `pubspec.lock`), check
   `command -v <cli> >/dev/null 2>&1` and refresh it if the CLI is in `PATH`
   (e.g., `npm install --package-lock-only --ignore-scripts`, `go mod tidy`,
   `composer update google/cloud-firestore --lock`,
   `bundle lock --update google-cloud-firestore`, `flutter pub get`). If a
   lockfile exists but the CLI is not in `PATH`, remind the user to refresh
   their lockfile before running `npm ci` or CI builds.
1. **Deprecation migration**: Check whether the repository uses any newly
   deprecated Firestore APIs associated with the version upgrade (e.g., Web v8
   `firebase.firestore()` -> modular `firebase/firestore`,
   `enableIndexedDbPersistence` -> `persistentLocalCache`, Python positional
   `.where("a", "==", "b")` -> `.where(filter=FieldFilter("a", "==", "b"))`,
   Android `firebase-firestore-ktx` -> `firebase-firestore`, iOS
   `FirebaseFirestoreSwift` -> `FirebaseFirestore`). Ask the user if they want
   to migrate from those deprecated APIs rather than refactoring their call
   sites automatically (unless the user explicitly requested a deprecation or
   code migration).

## 3. Deterministic Latest Version Queries

| SDK (`Manifest` — Package)                                            | Deterministic Latest Version Query                                                                                                                                                                                 |
| :-------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web** (`package.json` — `firebase`)                                 | `curl -m 5 -s https://registry.npmjs.org/firebase/latest \| grep -oE '"version":"[^"]+' \| head -1 \| cut -d'"' -f4`                                                                                               |
| **Node.js** (`package.json` — `@google-cloud/firestore`)              | `curl -m 5 -s https://registry.npmjs.org/@google-cloud/firestore/latest \| grep -oE '"version":"[^"]+' \| head -1 \| cut -d'"' -f4`                                                                                |
| **Python** (`requirements.txt` — `google-cloud-firestore`)            | `curl -m 5 -s https://pypi.org/rss/project/google-cloud-firestore/releases.xml \| grep -oE '<title>[0-9]+\.[0-9]+\.[0-9]+</title>' \| head -1 \| grep -oE '[0-9]+\.[0-9]+\.[0-9]+'`                                |
| **Go** (`go.mod` — `cloud.google.com/go/firestore`)                   | `curl -m 5 -s https://proxy.golang.org/cloud.google.com/go/firestore/@latest \| grep -oE '"Version":"[^"]+' \| cut -d'"' -f4`                                                                                      |
| **Java** (`pom.xml` — `com.google.cloud:google-cloud-firestore`)      | `curl -m 5 -s https://repo1.maven.org/maven2/com/google/cloud/google-cloud-firestore/maven-metadata.xml \| grep -oE '<version>[0-9]+\.[0-9]+\.[0-9]+</version>' \| tail -1 \| grep -oE '[0-9]+\.[0-9]+\.[0-9]+'`   |
| **Android** (`build.gradle.kts` — `com.google.firebase:firebase-bom`) | `curl -m 5 -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml \| grep -oE '<version>[0-9]+\.[0-9]+\.[0-9]+</version>' \| tail -1 \| grep -oE '[0-9]+\.[0-9]+\.[0-9]+'` |
| **iOS** (`Podfile` / `Package.swift` — `FirebaseFirestore`)           | `curl -m 5 -Ls -o /dev/null -w %{url_effective} https://github.com/firebase/firebase-ios-sdk/releases/latest \| xargs basename`                                                                                    |
| **.NET** (`*.csproj` — `Google.Cloud.Firestore`)                      | `curl -m 5 -s https://api.nuget.org/v3-flatcontainer/google.cloud.firestore/index.json \| grep -oE '"[0-9]+\.[0-9]+\.[0-9]+"' \| tail -1 \| tr -d '"'`                                                             |
| **PHP** (`composer.json` — `google/cloud-firestore`)                  | `curl -m 5 -s https://repo.packagist.org/p2/google/cloud-firestore.json \| grep -oE '"version":"v?[0-9]+\.[0-9]+\.[0-9]+"' \| head -1 \| grep -oE '[0-9]+\.[0-9]+\.[0-9]+'`                                        |
| **Ruby** (`Gemfile` — `google-cloud-firestore`)                       | `curl -m 5 -s https://rubygems.org/api/v1/versions/google-cloud-firestore/latest.json \| grep -oE '"version":"[^"]+' \| cut -d'"' -f4`                                                                             |
| **Flutter** (`pubspec.yaml` — `cloud_firestore`)                      | `curl -m 5 -s https://pub.dev/packages/cloud_firestore.json \| grep -oE '"[0-9]+\.[0-9]+\.[0-9]+"' \| head -1 \| tr -d '"'`                                                                                        |
