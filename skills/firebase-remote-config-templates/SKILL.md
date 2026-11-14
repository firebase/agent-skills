---
name: firebase-remote-config-templates
description: >-
  Manages Firebase Remote Config templates. Use ONLY when fetching, validating,
  or updating Remote Config parameters, conditions, condition priority order,
  parameterGroups, or version rollbacks. For Android/iOS client SDKs, use
  firebase-remote-config-basics. Don't use for CLI login, Gemini/AI, Hosting,
  Auth, Firestore, or Xcode.
compatibility: >-
  This skill is best used with the Firebase CLI, which can be accessed through
  `npx -y firebase-tools@latest`.
metadata:
  category: ApplicationDevelopment
---

# Firebase Remote Config Template Management

> [!IMPORTANT] **Client SDK Setup & Subagent Delegation**
> - **Do NOT read `firebase-remote-config-basics`** for template JSON or CLI
>   tasks. Only read `firebase-remote-config-basics` when adding Android/iOS
>   `firebase-config` SDKs, XML/Plist defaults, or `fetchAndActivate()`.
> - **Subagent Delegation vs. Direct Authoring**:
>   - **If subagent delegation AND `remote-config-template-architect` /
>     `remote-config-auditor` are available** in your environment: delegate
>     template authoring and modification to `remote-config-template-architect`
>     and pre-deployment verification to `remote-config-auditor`.
>   - **If subagent delegation is unavailable** (e.g., via `npx skills add` or
>     when subagent tools are not enabled) **OR if you are already running
>     inside `remote-config-template-architect`**: follow the workflow below and
>     run `rc_template_validator.py` directly.

This skill covers fetching, validating, authoring, deploying, and rolling back
Firebase Remote Config templates—including **parameters** (`parameters`),
**conditions** (`conditions`), **condition evaluation order** (the array index
order of `conditions[0..N-1]`, as there is no separate `conditionOrder` key in
the JSON schema), and **parameter groups** (`parameterGroups`)—via the Firebase
CLI (`npx -y firebase-tools@latest`).

## Troubleshooting Execution

1. **Registry 403 Fallback**: If `npx -y firebase-tools@latest` fails with HTTP
   403, inform the user and fall back to the local `firebase` binary if
   installed globally (`npm install -g firebase-tools`).
2. **Missing Active Project**: Run `npx -y firebase-tools@latest login:list` or
   check `.firebaserc`. If logged in but no project is active, ask the user for
   their `<PROJECT_ID>` and append `--project <PROJECT_ID>` to CLI commands.

## Template Management via Firebase CLI (Atomic Read-Modify-Write)

> **CRITICAL**: The Firebase CLI does **NOT** provide single-parameter or
> single-condition subcommands (commands like
> `firebase remoteconfig:parameters:set` or `...:conditions:add` do not exist).
> Instead, the entire configuration is fetched to a local `remote_config.json`
> file, modified in-place, and deployed as a single versioned template
> containing `"conditions"`, `"parameters"`, and `"parameterGroups"`.

Every modification to parameters, conditions, condition evaluation order, or
parameter groups **MUST** follow these five steps so existing configuration
items and server-managed values are preserved:

1. **Get Current Template**: Save the remote template to a local
   `remote_config.json` file for auditing or modification (to fetch a specific
   historical version, first run
   `npx -y firebase-tools@latest remoteconfig:versions:list [--limit <N>]` to
   find `<VERSION_NUMBER>`, then pass `-v <VERSION_NUMBER>`):
   ```bash
   npx -y firebase-tools@latest remoteconfig:get -o remote_config.json
   ```
2. **Autonomous Editing & Validation**: Modify the local `remote_config.json`
   directly—updating the targeted entries in `"conditions"` (or reordering
   `"conditions"` array indices `0..N-1` to change evaluation priority),
   `"parameters"`, or `"parameterGroups"` while preserving valid existing
   entries. All schema and expression rules are documented below—do **not** read
   the source code of `scripts/rc_template_validator.py`; edit the template JSON
   directly and **always** run
   `python3 <skill_dir>/scripts/rc_template_validator.py --fix-order <template.json>`
   to auto-sort `conditionalValues` keys, auto-normalize invalid `RC008`/`RC009`
   constructs, and verify that the validator exits `0` (`Status: PASSED`). If
   any `RC001`–`RC010` errors remain in the template (including pre-existing
   `RC008` rollout/experiment errors on other parameters or `RC009` expression
   errors), fix them in-place until `rc_template_validator.py --fix-order`
   exits `0`.
3. **MANDATORY: User Review and Verification**: STOP and ask the user to verify
   your changes before proceeding to deployment:
   - *"I have prepared the changes in `remote_config.json`. Please review the
     file for accuracy. Once you are satisfied, tell me to 'deploy' to make the
     changes live."*
4. **Deployment Orchestration**:
   - **Config Mapping**: If a `firebase.json` file is missing (or lacks a
     `remoteconfig` entry), create or update it to map the local
     `remote_config.json` file to the Remote Config service:
     ```json
     { "remoteconfig": { "template": "remote_config.json" } }
     ```
   - **Deploy**: Execute the partial deployment command:
     ```bash
     npx -y firebase-tools@latest deploy --only remoteconfig
     ```
5. **Verification & Rollback**: After deployment, verify the update by listing
   the version history, or roll back to a prior version if needed:
   ```bash
   npx -y firebase-tools@latest remoteconfig:versions:list
   npx -y firebase-tools@latest remoteconfig:rollback -v <VERSION_NUMBER>
   ```

## Critical User Journeys (CUJs) for Template Management

A complete Remote Config template has three top-level collections:
`"conditions": []`, `"parameters": {}`, and `"parameterGroups": {}`.

### CUJ 1: Create, Update, and Delete Parameters (`parameters`)

Top-level ungrouped parameters live in `"parameters"` (`{ "<key>": <Param> }`).

#### Parameter Schema & Validation Rules

- **Parameter Key Format**: Must match `/^[a-zA-Z_][0-9a-zA-Z_]*$/` (starts with
  an ASCII letter or `_`, followed by ASCII letters, digits, or `_`; max `256`
  characters). Hyphens (`-`), dots (`.`), spaces, and reserved JavaScript
  `Object.prototype` keys (`__proto__`, `constructor`, `prototype`,
  `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`,
  `toString`, `valueOf`, `__defineGetter__`, `__defineSetter__`,
  `__lookupGetter__`, `__lookupSetter__`) are **invalid**.
- **Global Key Uniqueness**: A parameter key must be unique across the entire
  template—it cannot exist in both top-level `"parameters"` and a group in
  `"parameterGroups"`, nor can it collide with any group key in
  `"parameterGroups"` (if asked to create a parameter with the same name as its
  group, disambiguate the parameter key, e.g. `<group>_mode`, so parameter and
  group keys remain disjoint).
- **`valueType` & Data Type Validation**:
  - `"STRING"` (default if omitted): Any UTF-8 string.
  - `"BOOLEAN"`: Case-insensitive `"true"` or `"false"`.
  - `"NUMBER"`: Static-only `NUMBER` parameters (those without `rolloutValue`,
    `experimentValue`, or `personalizationValue`) match `/^-?(\d*\.)?\d+$/`—always
    preserve requested leading-dot decimals like `".5"` or `".75"` verbatim on
    static parameters (even when converting a static parameter's `valueType` to
    `NUMBER`), while normalizing leading `"+"` (`"+0.5"` $\to$ `"0.5"`),
    scientific notation (`"1e2"` $\to$ `"100"`), and trailing dots (`"1."` $\to$
    `"1"`). When a `NUMBER` parameter has `rolloutValue`, `experimentValue`, or
    `personalizationValue`, `ValidationHelpers.NUMBER_REGEX`
    (`/^-?\d+(\.\d+)?$/`) requires a leading digit before any decimal point
    (normalize `".5"` $\to$ `"0.5"`, `"-.25"` $\to$ `"-0.25"` across
    `defaultValue`, `conditionalValues`, `rolloutValue.value`, and
    `experimentValue.variantValue[*].value`).
  - `"JSON"`: Must be valid JSON parseable by `JSON.parse(value)` (trailing
    commas, unquoted keys, or comments are rejected).
- **String-Encoded Static Values**: Every static `"value"` inside `defaultValue`
  and `conditionalValues` **MUST** be a JSON string—even for booleans, numbers,
  and JSON objects (e.g., `"value": "true"`, `"value": "42"`,
  `"value": "{\"tier\":\"pro\"}"`). Raw non-string JSON primitives fail
  validation.
- **`ParameterValue` Oneof, Omitted `defaultValue`, & Managed Values**:
  - A value object is a `oneof` of static values (`{"value": "<string>"}` or
    `{"useInAppDefault": true}`) or server-managed values
    (`personalizationValue`, `rolloutValue`, `experimentValue`). Both
    `defaultValue` and individual `conditionalValues[<cond>]` entries can use
    `{"useInAppDefault": true}` (never `{"useInAppDefault": false}`).
  - **Omitted `defaultValue` Rule**: `defaultValue` **MUST** be a static value
    (`{"value": "..."}` or `{"useInAppDefault": true}`). When no explicit
    fallback string is desired on a parameter with `conditionalValues`,
    `BOOLEAN`, `NUMBER`, and `JSON` parameters **MUST** explicitly set
    `"defaultValue": { "useInAppDefault": true }` (omitting `defaultValue`
    causes `ExternalProtoConverters` to synthesize `{"value": ""}`, which fails
    backend validation for non-`STRING` types).
  - **Rollout & Experiment Value Constraints**:
    - **REST / Console Import `rolloutValue` schema**: Uses
      `{"rolloutId": "<id>", "value": "<str>", "percent": <0..100>}` (when
      preparing a template for Console Import or v1 REST, convert
      `microPercentRange.microPercentEnd / 1000000` to `"percent"`, e.g.
      `25000000` $\to$ `25.0`, and remove `microPercentRange` /
      `enabledPercentCondition`).
    - **Internal `microPercentRange` bounds**: When `microPercentRange` is used,
      `microPercentStart` **must be `0`** and `microPercentEnd` **must be
      `<= 50000000` (50% max partial rollout cap) or `100000000` (100%)** (clamp
      any invalid partial range like `10000000..75000000` to `0..50000000`).
    - **Cross-parameter `experimentValue` consistency**: All parameters sharing
      the same `experimentId` **must** have the exact same `exposurePercent`
      (matching any active experiment state in the project) and the exact same
      list of `variantId`s (add `{"variantId": "0", "noChange": true}` if a
      parameter is unchanged in variant `"0"`).
    - **Active / Deleted Value Managers**: Remove any `rolloutValue`,
      `personalizationValue`, or `experimentValue` whose ID is `DELETED` or
      `STOPPED` in project state.
- **Template Limits**: Up to `3,000` parameters total and parameter
  `description` up to `256` characters.

#### Operations (Edit `remote_config.json`, Validate, then Deploy via CLI)

1. **Create or Update a Parameter**: Add or update `<param_key>` under
   `"parameters"` (or directly under `"parameterGroups[<group>].parameters"`):

   ```json
   {
     "parameters": {
       "welcome_message": {
         "defaultValue": { "value": "Welcome to our app!" },
         "conditionalValues": { "ios_us_users": { "value": "Howdy!" } },
         "description": "Headline text on the onboarding screen",
         "valueType": "STRING"
       }
     }
   }
   ```

2. **Duplicate, Rename, Change `valueType`, Swap Condition, or Selective Rollback**:
   - **Duplicate Parameter**: Copy static fields under a new unique `<new_key>`,
     **never copying `rolloutValue`, `personalizationValue`, or
     `experimentValue` IDs** (`DUPLICATE_ROLLOUT_ID` /
     `DUPLICATE_PERSONALIZATION_ID`). On the duplicate, replace any
     `rolloutValue` with static `{"value": "<rolloutValue.value>"}` and omit
     `personalizationValue` and `experimentValue`.
   - **Rename Parameter or Condition / Swap Condition**: In monolithic
     `RemoteConfig` JSON, `TemplateEntitiesRestConverter` keys parameters and
     conditions by `name`, so renaming `<old_key>` $\to$ `<new_key>` or
     renaming/swapping `<old_cond>` $\to$ `<new_cond>` mints a new entity ID and
     fails `ManagedValueValidator` (`INVALID_ROLLOUT_ID`,
     `INVALID_PERSONALIZATION_ID`) if `rolloutValue` or `personalizationValue`
     is kept. When renaming a parameter/condition or swapping a condition,
     replace any affected `rolloutValue` with static
     `{"value": "<rolloutValue.value>"}` and remove any affected
     `personalizationValue` from `conditionalValues`.
   - **Change `valueType`**: Update `valueType` and coerce `defaultValue.value`,
     static `conditionalValues[*].value`, `rolloutValue.value`, and
     `experimentValue.variantValue[*].value` to match the new `valueType`
     (on static-only parameters, preserve requested leading-dot decimals like
     `".75"`; on parameters with `rolloutValue` or `experimentValue`, normalize
     `".5"` $\to$ `"0.5"`, `"-.25"` $\to$ `"-0.25"`, and remove any
     `personalizationValue` whose `armValues` do not match the new `valueType`
     or whose ID is `DELETED`).
   - **Selective Parameter Rollback**: When rolling back regressed parameters
     from a historical template snapshot, **only restore the regressed
     parameters** into the live template while keeping unrelated live parameters
     and active `RUNNING` `rolloutValue`s intact (never overwrite an active
     `RUNNING` rollout with a historical `STOPPED` rollout).
3. **Delete a Parameter**: Remove `<param_key>` from `"parameters"` (or from
   `"parameterGroups[<group>].parameters"`), validate with
   `rc_template_validator.py --fix-order remote_config.json`, and deploy via
   `npx -y firebase-tools@latest deploy --only remoteconfig`.

### CUJ 2: Create, Update, and Delete Conditions (`conditions`)

Conditions are defined in the top-level `"conditions"` list and referenced by
`name` inside parameter `"conditionalValues"` maps.

#### Condition Schema & Validation Rules

- **`name`**: Must match `/^[-_0-9a-zA-Z '!%.]+$/`, be non-whitespace, unique
  after trimming, max `256` characters, with no leading/trailing spaces. Up to
  `2,000` conditions per template.
- **`tagColor`**: `"BLUE"`, `"BROWN"`, `"CYAN"`, `"DEEP_ORANGE"`, `"GREEN"`,
  `"INDIGO"`, `"LIME"`, `"ORANGE"`, `"PINK"`, `"PURPLE"`, or `"TEAL"`.
- **`expression` (Condition Expression Grammar & Mandatory Sanitization)**:
  - **Sanitize Invalid Requested Expressions Before Writing**: Never write an
    invalid condition expression into `conditions`. If a user prompt asks for
    `"false"` (`ALWAYS_FALSE`), omit that condition and its `conditionalValues`
    entry completely; if it combines multiple `app.id ==` clauses in one
    condition, split it into separate `<name>_ios` and `<name>_android`
    conditions (each with its own `device.os` and single `app.id`) and assign
    both in `conditionalValues`; if `.matches(['...'])` has an unclosed `[`
    character class (e.g. `'[v1-2'`), close it (`'[v1-2]'`); and if a country
    or language list contains `'UK'` or case-insensitive duplicates (e.g.
    `['US', 'UK', 'us']`), normalize `'UK'` $\to$ `'GB'` and deduplicate
    case-insensitively (`['US', 'GB']`).
  - **Conjunction Only (` && `)**: Clauses must be combined exclusively with
    ` && ` (max 50 clauses; max 10 items inside any `[...]` list). Top-level
    `||`, `!` negation, and `false` (`ConditionCase.ALWAYS_FALSE`) are
    **rejected** (`true` / `ALWAYS_TRUE` is allowed). Express OR logic via list
    operators (`in [...]`) or separate conditions in `"conditions"`.
  - **Supported Condition Signals**:
    - **Platform / Locale / Web Signals / All Users**: `device.os == 'ios'`
      (`==` only in Console; valid `device.os` literals are **only**
      `'android'`, `'ios'`, `'web'`—never `!=` or `device.os in [...]`),
      `device.country in ['US', 'GB']`, `device.language in ['en', 'es']` (list
      `in [...]` only—never `==` or negative operators; use ISO-3166 `'GB'`
      instead of invalid `'UK'`, and **deduplicate country and language codes
      case-insensitively**), `true` ("User exists"), and for Web apps
      (`device.os == 'web'`): `device.category.contains(['Mobile'])`
      (`notContains`),
      `app.operatingSystemAndVersion.inOne([operatingSystemName('Windows').anyVersion, operatingSystemName('Macintosh').version.>=('10')])`,
      and
      `app.browserAndVersion.inOne([browserName('Chrome').anyVersion, browserName('Safari').version.>=('15')])`
      (version operators `.==`, `.!=`, `.<`, `.<=`, `.>`, `.>=`).
    - **App Version / Build / ID / FID / First Open**:
      `app.version.>=(['2.1.0'])`, `app.build.>(['100'])` (numeric methods
      `.==`, `.!=`, `.<`, `.<=`, `.>`, `.>=` take a 1-item bracketed list
      matching `/^\d+([\d.]*\d)?$/`; never infix `app.version >= '2.1.0'`),
      string/regex methods `app.version.exactlyMatches(['2.1.0', '2.1.1'])`
      (`contains`, `notContains`, `matches`—every pattern in `.matches(['...'])`
      must be a valid, balanced regular expression; never `.regex`,
      `.startsWith`, or `.endsWith`), `app.id == '1:123:android:abc'` (`==`
      only; **at most one `app.id` clause per condition** per
      `RequiredNumberOfGmpAppIds.ZERO_OR_ONE`—to target multiple GMP app IDs,
      create separate per-app conditions and assign each in
      `conditionalValues`), `app.firebaseInstallationId in ['c123456789A']`
      (with `app.` prefix, matching
      `/^[cdef][\w-]{9}([AEIMQUYcgkosw048]|[\w-]{12})$/`),
      `app.firstOpenTimestamp > ('2025-01-01T00:00:00', 'UTC')` or
      `app.firstOpenTimestamp <= ('2025-01-01T00:00:00')` (with `app.` prefix,
      only `<=` and `>`, taking local `'YYYY-MM-DDTHH:mm:ss'` without `'Z'` or
      `'+HH:MM'` offsets and without `dateTime(...)`).
    - **Analytics Audiences, Imported Segments & User Properties**:
      `app.audiences.inAtLeastOne(['purchasers'])` (`inAtLeastOne` only in
      Console—never `inAll`, `notInAll`, `notInAtLeastOne`, or `.notIn`),
      `app.importedSegments.inAtLeastOne(['seg_1'])` (`inAll`, `inNone`,
      `notInAtLeastOne`),
      `app.userProperty['tier'].exactlyMatches(['gold'])` (`contains`,
      `notContains`, `matches`); numeric infix (`app.userProperty['age'] >= 21`)
      matches `/^[-+]?[0-9]{0,20}([.][0-9]{0,10})?$/`.
    - **Custom Signals**: String comparisons **MUST** use
      `.exactlyMatches(['...'])`, `.contains`, `.notContains`, or `.matches`
      (never `.regex`, `.startsWith`, `.endsWith`, or string `==`); numeric
      infix (`==`, `!=`, `<`, `<=`, `>`, `>=`) matches
      `/^[-+]?[0-9]{0,20}([.][0-9]{0,10})?$/`; semantic versions
      (`version(app.customSignal['ver']) >= '1.2.0'`) match
      `/^[0-9]+(?:\.[0-9]+){0,4}$/`.
    - **Time / Random Percentage**:
      `dateTime >= dateTime('2025-06-01T00:00:00', 'America/Los_Angeles')` or
      `dateTime < dateTime('2025-06-01T00:00:00')` (top-level `dateTime`,
      only `<` and `>=` against `dateTime('YYYY-MM-DDTHH:mm:ss'[, 'Timezone'])`
      with no embedded `'Z'` or `'+HH:MM'` offset),
      `percent <= 25`, `percent > 50`, `percent between 0 and 25`, or
      `percent('rollout_seed') between 0 and 25` (`<=`, `>`, or `between` with
      `0 <= lower <= upper <= 100`, at most 1 `percent` clause per condition;
      never `<`, `>=`, `==`; seed matches `/^[\w-.]*$/`, `<= 32` characters).

#### Referential Integrity & Experiment Guardrail

- **Create or Duplicate a Condition**: Append or insert the condition into
  top-level `"conditions"` **before or in the same atomic update** that adds its
  `name` to any parameter's `"conditionalValues"`. To duplicate a condition,
  copy its `expression` and `tagColor` under a new unique `name`:

  ```json
  { "conditions": [{ "name": "ios_us_users", "expression": "device.os == 'ios' && device.country in ['US']", "tagColor": "BLUE" }] }
  ```

- **Rename / Delete Condition (and Experiment Guardrail)**: When renaming a
  condition, atomically rename that key across **all** `"parameters"` and
  `"parameterGroups[*].parameters"` (and replace any attached `rolloutValue`
  with static `{"value": "<rolloutValue.value>"}` or strip
  `personalizationValue`). **Conditions referenced by an `experimentValue`
  MUST NOT be deleted** (`config_template_store.ts:isConditionUsedInExperiment`
  blocks deletion because removing the condition or its `experimentValue`
  permanently stops the running A/B test); keep the condition and its
  `experimentValue` intact. For non-experiment conditions, remove the
  condition's key from `"conditionalValues"` in **every** parameter across
  `"parameters"` and `"parameterGroups[*].parameters"`.

---

### CUJ 3: Condition Order & Evaluation Precedence

In Remote Config, the array order of `"conditions"` (`0..N-1`) directly controls
which value a user receives when multiple conditions match.

#### 1. First-Match-Wins & Specific-Before-Broad Precedence

- The top-level `"conditions"` array is evaluated in **strict descending
  priority from index `0` (highest priority) to index `N - 1` (lowest
  priority)**, returning the value of the **first** matching condition in the
  parameter's `"conditionalValues"` (or `defaultValue` if none match).
- **Specific-Before-Broad Rule**: Always place narrower intersection conditions
  at a **lower index (earlier in `"conditions"`)** than broader superset
  conditions. If `"all_ios"` (`device.os == 'ios'`) were placed at index `0`
  above `"ios_us_vip"` (`device.os == 'ios' && device.country in ['US']`), any
  parameter defining both would always resolve to `"all_ios"`, shadowing
  `"ios_us_vip"`.

#### 2. Reordering Conditions & Preserving `conditionalValues` Key Order

> **`conditionalValues` Priority Sorting**:
> Always keep the keys of every `"conditionalValues"` map (in both
> `"parameters"` and `"parameterGroups[*].parameters"`) sorted in the **exact
> relative order** of `"conditions[0..N-1]"` (while preserving each condition's
> value object, including `personalizationValue`, `rolloutValue`, or
> `experimentValue`):

```json
{
  "conditions": [
    { "name": "ios_us_vip", "expression": "device.os == 'ios' && device.country in ['US']" },
    { "name": "all_ios", "expression": "device.os == 'ios'" }
  ],
  "parameters": {
    "promo_discount_pct": {
      "defaultValue": { "value": "0" },
      "conditionalValues": {
        "ios_us_vip": { "value": "30" },
        "all_ios": { "value": "10" }
      },
      "valueType": "NUMBER"
    }
  }
}
```

---

### CUJ 4: Create and Manage Parameter Groups (`parameterGroups`)

Parameter groups organize related parameters into named folders in the Firebase
Console and template JSON under the top-level `"parameterGroups"` map.

#### Parameter Group Schema & Validation Rules

- **Structure**: Top-level `"parameterGroups"` maps each `<group_name>` (`1` to
  `256` characters, unique, non-whitespace, no leading/trailing spaces, max
  `1,000` groups) to `{ "description": "...", "parameters": { "<param_key>":
  <Parameter> } }` (with `description` up to `256` characters).
- **Single-Location & Cross-Entity Key Uniqueness**:
  1. A `<param_key>` can exist in **at most ONE place** in the template: either
     in `"parameters"` **OR** inside one
     `"parameterGroups[<group>].parameters"`.
  2. A group key **cannot** equal any existing group key or parameter name.
- **Client SDK Access Is Always Flat**:
  Parameter groups are purely organizational in the template and Console. Client
  SDKs always read grouped parameters by their bare `<param_key>` (e.g.,
  `remoteConfig.getString("checkout_button_color")`), **never** prefixed with
  the group name (`"checkout_flow.checkout_button_color"` is invalid).

#### Operations (Edit `remote_config.json`, Validate, then Deploy via CLI)

1. **Create or Edit a Parameter Group**: Create `<group_name>` under
   `"parameterGroups"`, or rename `<old_group>` to `<new_group>` / update its
   `"description"` while keeping its child `"parameters"` intact:

   ```json
   {
     "parameterGroups": {
       "checkout_flow": {
         "description": "Parameters controlling cart and payment screens",
         "parameters": {
           "checkout_button_color": {
             "defaultValue": { "value": "#1A73E8" },
             "conditionalValues": { "ios_us_users": { "value": "#0D47A1" } },
             "valueType": "STRING"
           }
         }
       }
     }
   }
   ```

2. **Move Parameters into a Group or Between Groups**: In a **single atomic
   template update**, remove `<param_key>` from its current location
   (`"parameters"` or `"parameterGroups[<old_group>].parameters"`) and insert it
   (preserving all fields) into `"parameterGroups[<new_group>].parameters"`.
3. **Ungroup Single Parameter, Ungroup All, or Delete Group**: Move a single
   parameter (keeping the group intact) or all child parameters from
   `"parameterGroups[<group>].parameters"` back into top-level `"parameters"`,
   and remove `"<group>"` from `"parameterGroups"` when deleting the group.
