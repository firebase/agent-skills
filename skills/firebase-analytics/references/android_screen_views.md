# Firebase Analytics Android Screen View Logging

This guide focuses exclusively on integrating screen view logging
(`FirebaseAnalytics.Event.SCREEN_VIEW`) into an Android application (Kotlin and
Java).

## When to Use This Guide

Use when adding screen tracking to Jetpack Compose navigation (NavHost,
Pagers, Voyager, state-based) or native Activities/Fragments to ensure
comprehensive screen view coverage.

## Integration Steps

Follow these steps sequentially to implement screen view logging.

### Step 1: Prerequisite Check

1.  Verify base Firebase configuration (`google-services.json` and Gradle
    dependencies) has been set up (via `android_setup.md`) and baseline
    compilation succeeds.

### Step 2: Plan Generation

1.  Identify **ALL SCREENS**, not simply key screens.
    *   **NO EXCLUSIONS**: Do NOT filter out files in directories like
        `third_party` or `vendor` if they compile directly into the application
        targets and represent user-facing screens.
    *   **Jetpack Compose & Activities/Fragments**: Include all Jetpack Compose
        composables, Activities, and Fragments representing standalone screens
        or navigation destinations.
2.  Generate a task-focused tracking plan at
    `analytics/firebase_analytics_screens_plan.md` containing a markdown table
    of all screens, formatted as follows:

```markdown
All Screens

| TaskID | Completed | Title        | Description | File Path |
| :----- | :-------- | :----------- | :---------- | :-------- |
| 1      | [ ]       | Home         | Main feed   | `app/src/main/java/.../HomeActivity.kt` |
```

### Step 3: File-By-File Screen Integration

Integrate **ALL SCREENS** by following these steps:

1.  Find the next unchecked task in
    `analytics/firebase_analytics_screens_plan.md`.
2.  Add screen view logging for that task using the guidelines below.
3.  Check the task.
4.  Continue integrating row-by-row until there are no more unchecked tasks.
5.  To make sure the edits don't break anything, build the project after every
    10 finished tasks (e.g. `./gradlew assembleDebug`).

#### Guidelines:

Guidelines for adding logging:

*   Add analytics events for every screen identified in the audit.
*   **Always add a documentation link** as a comment immediately preceding each
    Firebase Analytics API method call.

```kotlin
// Log a screen view event
// https://firebase.google.com/docs/analytics/screenviews#kotlin
```

#### Jetpack Compose Screen View Tracking Patterns

In Jetpack Compose, UI components are functions rather than standard Android
Activities or Fragments. The automatic screen tracking in Firebase Analytics
relies on `Activity` lifecycle callbacks and therefore does not detect Compose
navigation changes.

Depending on the navigation architecture of the app, implement manual tracking
using one of the specific patterns below.

##### 1. Jetpack Navigation (NavHost & NavController)

Whenever you need to add screen view tracking to a Compose `NavHost`, you must
add an `OnDestinationChangedListener` and wrap its setup in a `DisposableEffect`
to ensure it is properly cleaned up when the `NavHost` leaves the composition.

**Implementation:** Find the composable where `rememberNavController()` and
`NavHost` are defined, and insert this logic immediately after the `NavHost`:

```kotlin
// 1. Get an instance of FirebaseAnalytics
val context = androidx.compose.ui.platform.LocalContext.current
val firebaseAnalytics = androidx.compose.runtime.remember(context) {
    com.google.firebase.analytics.FirebaseAnalytics.getInstance(context)
}

// 2. Setup the listener using DisposableEffect
// https://firebase.google.com/docs/analytics/screenviews#kotlin
androidx.compose.runtime.DisposableEffect(navController) {
    val listener = androidx.navigation.NavController.OnDestinationChangedListener { _, destination, _ ->
        val screenName = destination.route ?: "Unknown"
        val bundle = android.os.Bundle().apply {
            putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_NAME, screenName)
            putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_CLASS, "YourActivityName")
        }
        firebaseAnalytics.logEvent(com.google.firebase.analytics.FirebaseAnalytics.Event.SCREEN_VIEW, bundle)
    }

    navController.addOnDestinationChangedListener(listener)

    onDispose {
        navController.removeOnDestinationChangedListener(listener)
    }
}
```

##### 2. State-Based Conditional Composition (Manual Navigation)

Many simpler apps, or apps migrating gradually to Compose, use a state variable
to dictate which composable is shown instead of a formal `NavHost`.

```kotlin
var currentScreen by remember { mutableStateOf("Home") }
```

**Implementation:** Use a `LaunchedEffect` keyed on the state variable to fire
the analytics event whenever the state changes.

```kotlin
val context = androidx.compose.ui.platform.LocalContext.current
val firebaseAnalytics = androidx.compose.runtime.remember(context) {
    com.google.firebase.analytics.FirebaseAnalytics.getInstance(context)
}

// https://firebase.google.com/docs/analytics/screenviews#kotlin
androidx.compose.runtime.LaunchedEffect(currentScreen) {
    val bundle = android.os.Bundle().apply {
        putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_NAME, currentScreen)
        putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_CLASS, "YourActivityName")
    }
    firebaseAnalytics.logEvent(com.google.firebase.analytics.FirebaseAnalytics.Event.SCREEN_VIEW, bundle)
}
```

##### 3. Pager-Based Navigation (HorizontalPager / VerticalPager)

For swipeable screens (like onboarding flows or main tab interfaces), developers
use `HorizontalPager` or `VerticalPager`. Swiping to a new page constitutes a
new screen view.

**Implementation:** Key a `LaunchedEffect` to `pagerState.currentPage`. Check
that the pager is not currently being scrolled to avoid logging intermediate
states during a drag.

```kotlin
val context = androidx.compose.ui.platform.LocalContext.current
val firebaseAnalytics = androidx.compose.runtime.remember(context) {
    com.google.firebase.analytics.FirebaseAnalytics.getInstance(context)
}

// https://firebase.google.com/docs/analytics/screenviews#kotlin
androidx.compose.runtime.LaunchedEffect(pagerState.currentPage, pagerState.isScrollInProgress) {
    if (!pagerState.isScrollInProgress) {
        val screenName = "Page_${pagerState.currentPage}"
        val bundle = android.os.Bundle().apply {
            putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_NAME, screenName)
            putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_CLASS, "YourActivityName")
        }
        firebaseAnalytics.logEvent(com.google.firebase.analytics.FirebaseAnalytics.Event.SCREEN_VIEW, bundle)
    }
}
```

##### 4. Voyager Navigation (Navigator & TabNavigator)

For apps utilizing the **Voyager** multiplatform navigation library, UI routing
is handled via `Navigator`, `TabNavigator`, or nested container screens.

**Implementation:** Use a `LaunchedEffect` keyed on the current active target
item inside the navigator. For a standard `Navigator`, track
`navigator.lastItem`. For a `TabNavigator`, track `tabNavigator.current`.

```kotlin
val context = androidx.compose.ui.platform.LocalContext.current
val firebaseAnalytics = androidx.compose.runtime.remember(context) {
    com.google.firebase.analytics.FirebaseAnalytics.getInstance(context)
}

// 1. Standard Voyager Navigator
// https://firebase.google.com/docs/analytics/screenviews#kotlin
androidx.compose.runtime.LaunchedEffect(navigator.lastItem) {
    val screen = navigator.lastItem
    val screenName = screen::class.simpleName ?: "Unknown"
    val bundle = android.os.Bundle().apply {
        putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_NAME, screenName)
        putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_CLASS, screenName)
    }
    firebaseAnalytics.logEvent(com.google.firebase.analytics.FirebaseAnalytics.Event.SCREEN_VIEW, bundle)
}

// 2. Voyager TabNavigator
// https://firebase.google.com/docs/analytics/screenviews#kotlin
androidx.compose.runtime.LaunchedEffect(tabNavigator.current) {
    val tab = tabNavigator.current
    val screenName = tab::class.simpleName ?: "Unknown"
    val bundle = android.os.Bundle().apply {
        putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_NAME, screenName)
        putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_CLASS, screenName)
    }
    firebaseAnalytics.logEvent(com.google.firebase.analytics.FirebaseAnalytics.Event.SCREEN_VIEW, bundle)
}
```

#### Important Guardrails for AI Agents

*   **Manually Log Native `Activity` Classes Only When Automatic Tracking is
    Disabled**: The Firebase Analytics SDK automatically captures standard
    `Activity` rendering as screen view events out-of-the-box. Injecting manual
    logging calls produces duplicative events unless automatic screen view
    reporting is explicitly disabled in the manifest. When automatic screen view
    tracking is disabled, you may manually log screen view events for `Activity`
    classes; otherwise, restrict custom tracking exclusively to Compose-level
    routing (NavHosts, nested screens, tabs, and pagers).
*   **Exhaustively Track Nested Navigator Layers**: Centralized listeners added
    to a root `Navigator` do not cascade to nested navigation scopes. Identify
    all instances of nested navigators across the codebase (including settings
    sub-screens, adaptive sheets, bottom sheet navigators, and dialog spaces)
    and explicitly attach telemetry listeners to each of them to prevent
    telemetry blind spots on deep screens.
*   **Carefully Manage Host Container Short-Circuits**: In production, if a
    parent screen functions solely as a container for child navigators or tabs
    (e.g. a root `HomeScreen` hosting a `TabNavigator`), skipping the host
    tracking (e.g. `if (screen is HomeScreen) return`) prevents double-logging,
    provided the inner active tab reliably logs the distinct destination.
    However, be aware that strict automated evaluation rubrics requiring every
    screen class to log an event will deduct points if a container screen is
    suppressed. Align your implementation with the explicit requirements of the
    task or evaluation rubric.
*   **Avoid Lifecycle Methods**: Do not attempt to use standard `Activity`
    lifecycle callbacks (`onResume` or `onStart`) for Compose-based routing
    tracking. These only trigger when the enclosing Activity changes state,
    completely bypassing interactive internal Compose state changes.
*   **Avoid Unqualified/KTX Shorthands**: Avoid Firebase KTX extension syntaxes
    (such as `Firebase.analytics` or the lambda-based `logEvent { ... }`) unless
    you have explicitly confirmed the required extension imports are present and
    functioning. Strongly prefer using standard fully-qualified calls
    (`FirebaseAnalytics.getInstance(context)` and explicit `Bundle().apply { ...
    }`) to guarantee compilation without unresolved reference errors across
    different Firebase SDK versions.
*   **Verify Dependencies**: Ensure that
    `com.google.firebase:firebase-analytics` is present in the
    `build.gradle(.kts)` dependencies so the logging calls compile successfully.

### Step 4: Verification and Cleanup

1.  Ensure all identified screen touchpoints from the audit are covered. If not,
    go back to the "File-By-File Screen Integration" step.
2.  Check that the project still builds (`./gradlew assembleDebug`).
3.  **Debug-Only `gaac_app_open` Event Verification & Cleanup**: Log a single
    `gaac_app_open` event with `gaac_*` parameters for debug purposes only to
    verify your changes. Remove this event once you have verified your changes.
    *(If you are performing both SDK setup and screen view integration in the
    same workflow, perform this `gaac_app_open` verification and cleanup once at
    the end of the combined workflow with `"gaac_tool_names"` set to
    `"firebase-analytics-android-setup,firebase-analytics-android-screen-views"`).*

    The event's parameters:

    *   `"gaac_agent_name"` = `"Antigravity"` (Replace with actual agent name)
    *   `"gaac_model_name"` = `"Gemini 3.5 Flash"` (Replace with actual model
        name)
    *   `"gaac_tool_names"` = `"firebase-analytics-android-screen-views"` or
        `"firebase-analytics-android-setup,firebase-analytics-android-screen-views"`
        *   This is a comma-separated list of skills/references used. For
            example,
            `"firebase-analytics-android-setup,firebase-analytics-android-screen-views"`
            means that you used the `firebase-analytics` skill and followed the
            references in `android_setup.md` and `android_screen_views.md`.
    *   `"gaac_tool_version"` = `"1.0.0"` // Must match the version number of
        the skill
    *   `"gaac_event_names"` =
        `<comma-separated list of event names that were added or modified>`
        *   For example, `"screen_view"` (or `"screen_view,add_to_cart"` if
            other events were also added or modified).

    As an AI coding agent, perform all verification and cleanup actions
    automatically without human intervention:

    1.  **Add the temporary `gaac_app_open` event:** Inside `onCreate` of your
        main launcher `Activity` (e.g., `MainActivity.kt`), obtain the
        `FirebaseAnalytics` instance and log a single `gaac_app_open` event with
        `gaac_*` parameters:

        ```kotlin
        val firebaseAnalytics = com.google.firebase.analytics.FirebaseAnalytics.getInstance(this)
        val gaacBundle = android.os.Bundle().apply {
            putString("gaac_agent_name", "Antigravity") // Replace with actual agent name
            putString("gaac_model_name", "Gemini 3.5 Flash") // Replace with actual model name
            putString("gaac_tool_names", "firebase-analytics-android-screen-views") // Comma-separated list of skills/references used
            putString("gaac_tool_version", "1.0.0") // Must match the version number of the skill
            putString("gaac_event_names", "screen_view") // Comma-separated list of event names added or modified
        }
        firebaseAnalytics.logEvent("gaac_app_open", gaacBundle)
        ```

    2.  **Enable Debug Mode and verify in Logcat:**

        1.  Run the app in the emulator with debug mode enabled (`adb shell
            setprop debug.firebase.analytics.app <package_name>`, `adb shell
            setprop log.tag.FA VERBOSE`, `adb shell setprop log.tag.FA-SVC
            VERBOSE`).
        2.  Search local debug console logs (Logcat) for `gaac_app_open`.

    3.  **Clean up:**

        1.  Remove the `gaac_app_open` event once verified.
        2.  Disable debug mode (`adb shell setprop debug.firebase.analytics.app
            .none.`).

    4.  **Point the User to Firebase DebugView (Console)**: [AGENT] When you are
        done, direct the human user to **Analytics > DebugView** in the Firebase
        Console so they can inspect live screen view events:

        *   [AGENT] Provide the human user with a constructed URL for the
            "Analytics" > "DebugView" page of the Firebase console. Use the
            Firebase `PROJECT_ID` (and `PACKAGE_NAME` if available) from
            `google-services.json` or `build.gradle(.kts)`:
            `https://console.firebase.google.com/u/0/project/PROJECT_ID/analytics/debugview`
            (or
            `https://console.firebase.google.com/u/0/project/PROJECT_ID/analytics/app/android:PACKAGE_NAME/debugview`;
            if `PROJECT_ID` is not available, use
            `https://console.firebase.google.com/u/0/project/_/analytics/debugview`).

## Implementation Examples

When adding or updating Firebase Analytics screen view code, ensure the
documentation link is added as a comment as shown below:

```kotlin
// Log a screen view event
// https://firebase.google.com/docs/analytics/screenviews#kotlin
val bundle = android.os.Bundle().apply {
    putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_NAME, "SomeScreen")
    putString(com.google.firebase.analytics.FirebaseAnalytics.Param.SCREEN_CLASS, "SomeScreenActivity")
}
firebaseAnalytics.logEvent(com.google.firebase.analytics.FirebaseAnalytics.Event.SCREEN_VIEW, bundle)
```

## Documentation URLs

This table lists each public API and the documentation link(s) to use in
comments:

Method                                | Action                  | Doc URLs
:------------------------------------ | :---------------------- | :-------
`FirebaseAnalytics.Event.SCREEN_VIEW` | Log a screen view event | <https://firebase.google.com/docs/analytics/screenviews#kotlin>
