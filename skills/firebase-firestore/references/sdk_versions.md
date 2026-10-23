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
1. Inspect the manifest file locally (and if unsure whether the pinned version
   is already current, run the `curl` check from Section 3). If the pinned
   Firestore SDK is already at the latest stable version and no deprecated APIs
   are used, do **not** append any upgrade prompt. Only when the pinned SDK is
   outdated or the codebase uses deprecated patterns (e.g., Web v8
   `firebase.firestore()`, `enableIndexedDbPersistence`, Python positional
   `.where("a", "==", "b")`, Android `firebase-firestore-ktx`, iOS
   `FirebaseFirestoreSwift`), complete the user's task and append a 1-line offer
   at the end of your response (naming the BOM coordinate if versions are
   managed via `libraries-bom` or `firebase-bom`):
   > *"Note: `<package>` is pinned to `<current_version>`. Reply **upgrade
   > firestore** if you want me to bump it to the latest stable version."*

## 2. Adding Firestore, Project Setup, or Explicit Upgrade Requests

Whenever adding Firestore dependencies, scaffolding a project, or fulfilling an
upgrade request:

1. Run the single `curl` command from the table below to fetch the latest stable
   `X.Y.Z` version directly from the package registry (do **not** run `find`,
   `grep -r`, or `python3 -c` to search the filesystem or locate binaries; use
   `ls -R <project_dir>` if listing project files, and ignore pre-release tags
   containing `-alpha`, `-beta`, `-rc`, `-dev`, or `-eap`).
1. Edit the dependency manifest file (`package.json`, `requirements.txt`,
   `pyproject.toml`, `go.mod`, `pom.xml`, `build.gradle`, `build.gradle.kts`,
   `gradle/libs.versions.toml`, `Podfile`, `Package.swift`, `*.csproj`,
   `Directory.Packages.props`, `composer.json`, `Gemfile`, `*.gemspec`, or
   `pubspec.yaml`) across all workspace packages/projects that declare Firestore
   to set the latest version (preserving the manifest's existing range prefix
   such as `^` or `~>`):
   - **BOMs, Properties & Central Version Catalogs**: If the project manages
     versions via `com.google.cloud:libraries-bom` (including in a parent
     `pom.xml` of a multi-module Maven build), Maven `<properties>` (e.g.,
     `<google-cloud-firestore.version>`), `com.google.firebase:firebase-bom`,
     `gradle/libs.versions.toml`, or .NET Central Package Management
     (`Directory.Packages.props` with `ManagePackageVersionsCentrally`), update
     the version in the BOM / `<properties>` / catalog /
     `Directory.Packages.props` (including companion `Google.Cloud.Firestore.V1`
     if present) rather than adding an explicit version override on the child
     dependency in `pom.xml`, `build.gradle(.kts)`, or `*.csproj`.
   - **Coupled Firebase packages (Flutter & iOS)**: In Flutter (`pubspec.yaml`),
     update `firebase_core` (`https://pub.dev/packages/firebase_core.json`) and
     any sibling `firebase_*` plugins (via
     `https://pub.dev/packages/<plugin>.json`, e.g., `firebase_auth`,
     `firebase_storage`, `firebase_messaging`) that share the `firebase_core`
     constraint to their latest stable versions alongside `cloud_firestore` so
     `flutter pub get` does not fail with a version solver conflict. In iOS
     (`Podfile`), if sibling `Firebase*` pods (e.g., `FirebaseAuth`,
     `FirebaseCore`) are pinned to the same version as `FirebaseFirestore`,
     update them together so `FirebaseCore` resolves cleanly (and if the minimum
     iOS deployment target in `Podfile` or `Package.swift` is below `15.0`, bump
     it to `platform :ios, '15.0'` or `.iOS(.v15)` as required by Firebase iOS
     SDK v11+).
   - **Removed coordinates (Android `-ktx` & iOS `FirebaseFirestoreSwift`)**:
     When upgrading Android (`firebase-bom` `34.0.0+`, or standalone
     `com.google.firebase:firebase-firestore` via
     `https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-firestore/maven-metadata.xml`
     if no BOM is used), replace `com.google.firebase:firebase-firestore-ktx`
     (and any sibling BOM-managed `firebase-*-ktx` coordinates) with their main
     module coordinates (e.g., `com.google.firebase:firebase-firestore`) in
     `build.gradle(.kts)` and `gradle/libs.versions.toml`, and strip `.ktx` from
     imports across all Kotlin files (e.g., `com.google.firebase.ktx.Firebase`
     -> `com.google.firebase.Firebase`,
     `com.google.firebase.firestore.ktx.{firestore,toObject,toObjects,snapshots}`
     ->
     `com.google.firebase.firestore.{firestore,toObject,toObjects,snapshots}`,
     as `-ktx` artifacts were removed in `firebase-bom` v34.0.0+ /
     `firebase-firestore` v26.0.0+). When upgrading iOS `FirebaseFirestore` to
     `11.0.0+`, remove `FirebaseFirestoreSwift` from `Podfile` / `Package.swift`
     (across all targets) and remove `import FirebaseFirestoreSwift` across all
     Swift files in the project (as it was merged into `FirebaseFirestore` and
     removed in v11.0.0+).
1. **Lockfile sync**: If a lockfile exists (`package-lock.json`, `poetry.lock`,
   `go.sum`, `packages.lock.json`, `composer.lock`, `Gemfile.lock`,
   `Podfile.lock`, `pubspec.lock`), check `which <cli>` and refresh it if the
   CLI is in `PATH` (e.g., `npm install --package-lock-only --ignore-scripts`,
   `poetry lock --no-update`, `go mod tidy`, `dotnet restore --force-evaluate`,
   `composer update google/cloud-firestore --lock`,
   `bundle lock --update google-cloud-firestore`, `flutter pub get`). If a
   lockfile exists but the CLI is not in `PATH`, remind the user to refresh
   their lockfile before running `npm ci` or CI builds.
1. **Deprecation migration**: Check whether the repository uses deprecated
   Firestore call-site APIs (e.g., Web v8 `firebase.firestore()` -> modular v9+
   `firebase/firestore`, `enableIndexedDbPersistence(db)` ->
   `initializeFirestore(app, { localCache: persistentLocalCache() })`,
   `enableMultiTabIndexedDbPersistence(db)` ->
   `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`,
   Python positional `.where("a", "==", "b")` ->
   `.where(filter=FieldFilter("a", "==", "b"))`). Ask the user if they want to
   migrate those call sites rather than refactoring application logic
   automatically (for Web v8 -> v9+, either migrate call sites to modular v9+
   with user confirmation or switch `firebase/app` and `firebase/firestore`
   imports across all project files to `firebase/compat/app` and
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
