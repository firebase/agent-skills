# Firestore SDK Version Resolution & Upgrade Guide

Never guess or hardcode memorized SDK versions from training weights.

## 1. Modifying Code in an Existing Repo with a Pinned SDK

When editing application code in a repository that already has an older
Firestore SDK pinned:

1. Do **not** silently mutate the dependency manifest or lockfile during an
   unrelated feature or bugfix edit (unless the requested feature requires a
   newer SDK, such as Enterprise Pipelines or Vector Search). Match the pinned
   SDK's imports and API surface so the existing build does not break (e.g., do
   not emit modular v9+ imports in a repo still pinned to Web v8, or strip
   `FirebaseFirestoreSwift` in a repo still pinned to iOS `< 11.0.0`).
1. Inspect the manifest file locally. If the pinned Firestore SDK is outdated or
   the codebase uses deprecated patterns (e.g., Web v8 `firebase.firestore()`,
   `enableIndexedDbPersistence`, Python positional `.where("a", "==", "b")`,
   Android `firebase-firestore-ktx`, iOS `FirebaseFirestoreSwift`), complete the
   user's task and append a 1-line offer at the end of your response (naming the
   BOM coordinate if versions are managed via `libraries-bom` or
   `firebase-bom`):
   > *"Note: `<package>` is pinned to `<current_version>`. Reply **upgrade
   > firestore** if you want me to bump it to the latest stable version."*

## 2. Adding Firestore, Project Setup, or Explicit Upgrade Requests

Whenever adding Firestore dependencies, scaffolding a project, or fulfilling an
upgrade request:

1. Run the single `curl` command from the table below to fetch the latest stable
   `X.Y.Z` version directly from the package registry (do **not** search the
   filesystem if package manager CLIs like `npm`, `mvn`, `dotnet`, `composer`,
   `bundle`, or `pod` are not in `PATH`, and ignore pre-release tags containing
   `-alpha`, `-beta`, `-rc`, `-dev`, or `-eap`).
1. Edit the dependency manifest file (`package.json`, `requirements.txt`,
   `pyproject.toml`, `go.mod`, `pom.xml`, `build.gradle.kts`,
   `gradle/libs.versions.toml`, `Podfile`, `Package.swift`, `*.csproj`,
   `Directory.Packages.props`, `composer.json`, `Gemfile`, or `pubspec.yaml`) to
   set the latest version (preserving the manifest's existing range prefix such
   as `^` or `~>`):
   - **BOMs & Central Version Catalogs**: If the project manages versions via
     `com.google.cloud:libraries-bom`, `com.google.firebase:firebase-bom`,
     `gradle/libs.versions.toml`, or .NET Central Package Management
     (`Directory.Packages.props` with `ManagePackageVersionsCentrally`), update
     the version in the BOM / catalog / `Directory.Packages.props` rather than
     adding an explicit version override on the child dependency in `pom.xml`,
     `build.gradle.kts`, or `*.csproj`.
   - **Flutter (`pubspec.yaml`)**: Also update `firebase_core` to its latest
     stable version alongside `cloud_firestore` to avoid version solver
     conflicts.
   - **Removed coordinates (Android `-ktx` & iOS `FirebaseFirestoreSwift`)**:
     When upgrading `firebase-bom` to `34.0.0+`, replace
     `com.google.firebase:firebase-firestore-ktx` with
     `com.google.firebase:firebase-firestore` (in `build.gradle.kts` and
     `gradle/libs.versions.toml` if used) and update
     `com.google.firebase.ktx.Firebase` /
     `com.google.firebase.firestore.ktx.firestore` imports to
     `com.google.firebase.Firebase` / `com.google.firebase.firestore.firestore`
     (as `-ktx` artifacts were removed from `firebase-bom` v34.0.0+). When
     upgrading iOS `FirebaseFirestore` to `11.0.0+`, remove
     `FirebaseFirestoreSwift` from `Podfile` / `Package.swift` and remove
     `import FirebaseFirestoreSwift` from Swift files (as it was merged into
     `FirebaseFirestore` and removed in v11.0.0+).
1. **Lockfile sync**: If a lockfile exists (`package-lock.json`, `go.sum`,
   `packages.lock.json`, `composer.lock`, `Gemfile.lock`, `Podfile.lock`,
   `pubspec.lock`), check `command -v <cli> >/dev/null 2>&1` and refresh it if
   the CLI is in `PATH` (e.g.,
   `npm install --package-lock-only --ignore-scripts`, `go mod tidy`,
   `dotnet restore --force-evaluate`,
   `composer update google/cloud-firestore --lock`,
   `bundle lock --update google-cloud-firestore`, `flutter pub get`). If a
   lockfile exists but the CLI is not in `PATH`, remind the user to refresh
   their lockfile before running `npm ci` or CI builds.
1. **Deprecation migration**: Check whether the repository uses deprecated
   Firestore call-site APIs (e.g., Web v8 `firebase.firestore()` -> modular v9+
   `firebase/firestore`, `enableIndexedDbPersistence` -> `persistentLocalCache`,
   Python positional `.where("a", "==", "b")` ->
   `.where(filter=FieldFilter("a", "==", "b"))`). Ask the user if they want to
   migrate those call sites rather than refactoring application logic
   automatically (for Web v8 -> v9+, either migrate call sites to modular v9+
   with user confirmation or switch imports to `firebase/compat/app` and
   `firebase/compat/firestore` so the build does not break).

## 3. Deterministic Latest Version Queries

Run these single, pipe-free `curl` commands and read the latest stable `X.Y.Z`
version from the response (`"latest"` in npm `dist-tags` / `pub.dev`,
`<release>` in Maven `maven-metadata.xml`, first stable `<title>X.Y.Z</title>`
in PyPI RSS, last stable `"X.Y.Z"` in NuGet `index.json`, `"Version"` in Go
proxy, `"version"` in RubyGems, or the `/releases/tag/[v]X.Y.Z` suffix for
GitHub releases):

| SDK (`Manifest` — Package)                                                                   | Deterministic Latest Version Query (`curl`)                                                                                                                                                              |
| :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web** (`package.json` — `firebase`)                                                        | `curl -m 5 -s https://registry.npmjs.org/-/package/firebase/dist-tags`                                                                                                                                   |
| **Node.js** (`package.json` — `@google-cloud/firestore`)                                     | `curl -m 5 -s https://registry.npmjs.org/-/package/@google-cloud/firestore/dist-tags`                                                                                                                    |
| **Python** (`requirements.txt` / `pyproject.toml` — `google-cloud-firestore`)                | `curl -m 5 -s https://pypi.org/rss/project/google-cloud-firestore/releases.xml`                                                                                                                          |
| **Go** (`go.mod` — `cloud.google.com/go/firestore`)                                          | `curl -m 5 -s https://proxy.golang.org/cloud.google.com/go/firestore/@latest`                                                                                                                            |
| **Java** (`pom.xml` / `build.gradle.kts` — `google-cloud-firestore` or `libraries-bom`)      | `curl -m 5 -s https://repo1.maven.org/maven2/com/google/cloud/google-cloud-firestore/maven-metadata.xml` (or `https://repo1.maven.org/maven2/com/google/cloud/libraries-bom/maven-metadata.xml` for BOM) |
| **Android** (`build.gradle.kts` / `libs.versions.toml` — `com.google.firebase:firebase-bom`) | `curl -m 5 -s https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-bom/maven-metadata.xml`                                                                                               |
| **iOS** (`Podfile` / `Package.swift` — `FirebaseFirestore`)                                  | `curl -m 5 -Ls -o /dev/null -w %{url_effective} https://github.com/firebase/firebase-ios-sdk/releases/latest`                                                                                            |
| **.NET** (`*.csproj` / `Directory.Packages.props` — `Google.Cloud.Firestore`)                | `curl -m 5 -s https://api.nuget.org/v3-flatcontainer/google.cloud.firestore/index.json`                                                                                                                  |
| **PHP** (`composer.json` — `google/cloud-firestore`)                                         | `curl -m 5 -Ls -o /dev/null -w %{url_effective} https://github.com/googleapis/google-cloud-php-firestore/releases/latest`                                                                                |
| **Ruby** (`Gemfile` — `google-cloud-firestore`)                                              | `curl -m 5 -s https://rubygems.org/api/v1/versions/google-cloud-firestore/latest.json`                                                                                                                   |
| **Flutter** (`pubspec.yaml` — `cloud_firestore` & `firebase_core`)                           | `curl -m 5 -s https://pub.dev/packages/cloud_firestore.json` (and `https://pub.dev/packages/firebase_core.json`)                                                                                         |
