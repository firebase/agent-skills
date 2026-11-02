# Firebase Analytics iOS Screen View Logging

This guide focuses exclusively on integrating screen view logging
(`AnalyticsEventScreenView`) into an iOS application (Swift and Objective-C).

## When to Use This Guide

Use when adding screen tracking to ViewControllers, SwiftUI Views, or base
classes to ensure comprehensive screen view coverage.

## Integration Steps

Follow these steps sequentially to implement screen view logging.

### Step 1: Prerequisite Check

1.  Verify base Firebase configuration (`GoogleService-Info.plist` and
    dependency setup) has been configured (via `ios_setup.md`) and baseline
    compilation succeeds.

### Step 2: Plan Generation

1.  Identify **ALL SCREENS**, not simply key screens.
    *   **NO EXCLUSIONS**: Do NOT filter out files in directories like `Third
        Party Code`, `third_party`, or `Vendor` if they compile directly into
        the application targets and represent user-facing screens.
    *   **SwiftUI Views & ViewControllers**: Include all SwiftUI `View` structs
        representing screens and all `UIViewController` subclasses in the plan.
2.  Generate a task-focused tracking plan at
    `analytics/firebase_analytics_screens_plan.md` containing a markdown table
    of all screens, formatted as follows:

```markdown
All Screens

| TaskID | Completed | Title        | Description | File Path |
| :----- | :-------- | :----------- | :---------- | :-------- |
| 1      | [ ]       | Home         | Main feed   | `App/Views/MainVC.swift` |
```

### Step 3: File-By-File Screen Integration

Integrate **ALL SCREENS** by following these steps:

1.  Find the next unchecked task in
    `analytics/firebase_analytics_screens_plan.md`.
2.  Add screen view logging for that task using the guidelines below.
3.  Check the task.
4.  Continue integrating row-by-row until there are no more unchecked tasks.
5.  To make sure the edits don't break anything, build the project after every
    10 finished tasks.

#### Guidelines:

Guidelines for adding logging:

*   Add analytics events for every screen identified in the audit.
*   **Do NOT use method swizzling** — never use method swizzling (e.g.
    Objective-C runtime swizzling of `viewDidAppear:`) to automate screen
    view logging.
*   **Architectural Strategy & Coverage**: You are encouraged to use
    centralized or base class tracking (e.g., adding tracking to a shared custom
    `UIViewController` superclass) to minimize code duplication. However, if
    you use a base class, you MUST systematically verify every single screen
    identified in your audit.
    *   For any SwiftUI Views, Objective-C controllers, or standalone Swift
        ViewControllers that do not inherit from your tracked base class, you
        MUST add explicit `logEvent` calls to them directly (or add them
        manually to the tracking plan and implement them). Do not mark a screen
        as completed in your plan until you have verified its inheritance or
        explicitly logged it.
*   **Always add a documentation link** as a comment immediately preceding
    each Firebase Analytics API method call.

```swift
// Log a screen view event
// https://firebase.google.com/docs/analytics/screenviews
```

#### UIKit Screen View Tracking Patterns

For UIKit-based apps, screen views are tracked using view controller
lifecycle methods.

##### 1. Swift UIViewController
Add the logging code inside `viewDidAppear(_:)`. Ensure you call
`super.viewDidAppear(animated)`.

```swift
import FirebaseAnalytics

class MyViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        // Log a screen view event
        // https://firebase.google.com/docs/analytics/screenviews
        Analytics.logEvent(AnalyticsEventScreenView, parameters: [
            AnalyticsParameterScreenName: "My Screen",
            AnalyticsParameterScreenClass: String(describing: Self.self)
        ])
    }
}
```

##### 2. Objective-C UIViewController
Add the logging code inside `viewDidAppear:`. Ensure you call
`[super viewDidAppear:animated]`.

```objc
#import <FirebaseAnalytics/FirebaseAnalytics.h>

@implementation MyViewController

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];

    // Log a screen view event
    // https://firebase.google.com/docs/analytics/screenviews
    [FIRAnalytics logEventWithName:kFIREventScreenView
        parameters:@{
            kFIRParameterScreenName: @"My Screen",
            kFIRParameterScreenClass: NSStringFromClass([self class])
        }];
}

@end
```

#### SwiftUI Screen View Tracking Patterns

For SwiftUI-based apps, you can use the `.onAppear` modifier to log screen
views manually with custom parameters.

##### 1. SwiftUI View manual tracking
Use the `.onAppear` block on the top-level container of the view.

```swift
import SwiftUI
import FirebaseAnalytics

struct MyView: View {
    var body: some View {
        VStack {
            Text("Hello, World!")
        }
        .onAppear {
            // Log a screen view event
            // https://firebase.google.com/docs/analytics/screenviews
            Analytics.logEvent(AnalyticsEventScreenView, parameters: [
                AnalyticsParameterScreenName: "My Screen",
                AnalyticsParameterScreenClass: "MyView"
            ])
        }
    }
}
```

#### Important Guardrails for AI Agents

*   **Manually Log UIViewController Classes Only When Automatic Tracking is
    Disabled**: Firebase Analytics automatically tracks screen views for UIKit
    `UIViewController` classes out-of-the-box. Double-logging will occur if
    manual tracking is added without disabling automatic screen view tracking
    (by setting `FirebaseAutomaticScreenReportingEnabled` to `NO` / `false` in
    `Info.plist`). If automatic tracking is enabled, restrict custom tracking
    exclusively to SwiftUI Views or instances where distinct custom names are
    required.
*   **Verify Dependencies**:
    Ensure that FirebaseAnalytics is imported and linked properly in your Xcode
    project/targets or Swift Package Manager `Package.swift`.

### Step 4: Verification and Cleanup

1.  Ensure all identified screen touchpoints from the audit are covered. If
    not, go back to the "File-By-File Screen Integration" step.
2.  Check that the project still builds.
3.  **Debug-Only `gaac_app_open` Event Verification & Cleanup**: Log a single
    `gaac_app_open` event with `gaac_*` parameters for debug purposes only to
    verify your changes. Remove this event once you have verified your changes.
    *(If you are performing both SDK setup and screen view integration in the
    same workflow, perform this `gaac_app_open` verification and cleanup once at
    the end of the combined workflow with `"gaac_tool_names"` set to
    `"firebase-analytics-ios-setup,firebase-analytics-ios-screen-views"`).*

    The event's parameters:

    *   `"gaac_agent_name"` = `"Antigravity"` (Replace with actual agent name)
    *   `"gaac_model_name"` = `"Gemini 3.5 Flash"` (Replace with actual model
        name)
    *   `"gaac_tool_names"` = `"firebase-analytics-ios-screen-views"` or
        `"firebase-analytics-ios-setup,firebase-analytics-ios-screen-views"`
        *   This is a comma-separated list of skills/references used. For
            example,
            `"firebase-analytics-ios-setup,firebase-analytics-ios-screen-views"`
            means that you used the `firebase-analytics` skill and followed the
            references in `ios_setup.md` and `ios_screen_views.md`.
    *   `"gaac_tool_version"` = `"1.0.0"` // Must match the version number of
        the skill
    *   `"gaac_event_names"` =
        `<comma-separated list of event names that were added or modified>`
        *   For example, `"screen_view"` (or `"screen_view,add_to_cart"` if
            other events were also added or modified).

    As an AI coding agent, perform all verification and cleanup actions
    automatically without human intervention:

    1.  **Add the temporary `gaac_app_open` event:** Immediately after
        `FirebaseApp.configure()` in your initialization code (`AppDelegate` or
        `App.init()`), add a single `gaac_app_open` event with `gaac_*`
        parameters:

        *   **Swift:**

            ```swift
            import FirebaseAnalytics

            Analytics.logEvent("gaac_app_open", parameters: [
                "gaac_agent_name": "Antigravity", // Replace with actual agent name
                "gaac_model_name": "Gemini 3.5 Flash", // Replace with actual model name
                "gaac_tool_names": "firebase-analytics-ios-screen-views", // Comma-separated list of skills/references used
                "gaac_tool_version": "1.0.0", // Must match the version number of the skill
                "gaac_event_names": "screen_view" // Comma-separated list of event names added or modified
            ])
            ```

        *   **Objective-C:**

            ```objc
            #import <FirebaseAnalytics/FirebaseAnalytics.h>

            [FIRAnalytics logEventWithName:@"gaac_app_open"
                                parameters:@{
                                    @"gaac_agent_name": @"Antigravity", // Replace with actual agent name
                                    @"gaac_model_name": @"Gemini 3.5 Flash", // Replace with actual model name
                                    @"gaac_tool_names": @"firebase-analytics-ios-screen-views", // Comma-separated list of skills/references used
                                    @"gaac_tool_version": @"1.0.0", // Must match the version number of the skill
                                    @"gaac_event_names": @"screen_view" // Comma-separated list of event names added or modified
                                }];
            ```

    2.  **Enable Debug Mode and verify local debug console logs:**

        1.  Run the app in the simulator with the `-FIRAnalyticsDebugEnabled`
            (or `-FIRDebugEnabled`) flag.
        2.  Search local debug console logs for `gaac_app_open`.

    3.  **Clean up:**

        1.  Remove the `gaac_app_open` event once verified.
        2.  Remove the `-FIRAnalyticsDebugEnabled` / `-FIRDebugEnabled` flag
            from your launch arguments if it was added to the scheme.

    4.  **Point the User to Firebase DebugView (Console)**: [AGENT] When you are
        done, direct the human user to **Analytics > DebugView** in the Firebase
        Console so they can inspect live screen view events:

        *   [AGENT] Provide the human user with a constructed URL for the
            "Analytics" > "DebugView" page of the Firebase console. Use the
            Firebase `PROJECT_ID` (and `BUNDLE_ID` if available) from
            `GoogleService-Info.plist`:
            `https://console.firebase.google.com/u/0/project/PROJECT_ID/analytics/debugview`
            (or
            `https://console.firebase.google.com/u/0/project/PROJECT_ID/analytics/app/ios:BUNDLE_ID/debugview`;
            if `PROJECT_ID` is not available, use
            `https://console.firebase.google.com/u/0/project/_/analytics/debugview`).

## Implementation Examples

When adding or updating Firebase Analytics screen view code, ensure the
documentation link is added as a comment as shown below:

```swift
// Log a screen view event
// https://firebase.google.com/docs/analytics/screenviews
Analytics.logEvent(AnalyticsEventScreenView, parameters: [
    AnalyticsParameterScreenName: "SomeScreen",
    AnalyticsParameterScreenClass: "SomeViewController"
])
```

## Documentation URLs

This table lists each public API and the documentation link(s) to use in
comments:

Method | Action | Doc URLs
:--- | :--- | :---
`AnalyticsEventScreenView` (Swift) / `kFIREventScreenView` (ObjC) | Log a screen view event | <https://firebase.google.com/docs/analytics/screenviews>
