---
name: firebase-functions-params-refactor
description: Refactor Firebase Functions (AKA Cloud Functions for Fireabase) codebases to use the new params API instead of the deprecated functions.config API
version: 0.0.1
---

# Firebase Functions Params Refactor

## Context
The user wants to migrate legacy Cloud Functions code from `functions.config()` (Runtime Config) to the modern `firebase-functions/params` API.
This is important because Runtime Config is deprecated and will be removed in the future. Runtime Config is also not available in the v2 functions
API, which is more powerful and recommended for new code.
This skill requires the Firebase MCP tool.

## Triggers
Activate this skill when:
1. The user asks to "migrate config", "upgrade to params", or "switch to params".
2. You detect `functions.config()` usage in the code snippet.

# Follow up
This skill refactors the code but does not move data from functions.config() to .env files and Cloud Secret Manager. That skill is firebase-functions-params-data-migration and should be run after this skill. This is a separate skill so it can be run across multiple
projects.

## Rules & Constraints

### Scope Placement
- Legacy `functions.config()` could be called *inside* functions.
- Modern `defineString`, `defineInt`, and `defineSecret` MUST be defined at the **global/top-level scope**, outside of any function export.
- Any global that depends on the config MUST be initialized in a call to `onInit`.  For example:
   
    ```typescript
    const myFoo = new Foo(functions.config().foo);
    ```

    should be turned into

    ```typescript
    const foo = defineString('FOO', { /* descriptions */ });
    let myFoo: Foo;
    onInit(() => {
      myFoo = new Foo(foo.value());
    });
    ```

    and never

    ```typescript
    const foo = defineString('FOO', { /* descriptions */ });
    const getFoo() { 
        return new Foo(foo.value);
    }
    ```

    NOTE: `onInit` may only be called once per codebase, so you may need to factor these globals out into a single file. If this is the case,
    do the refactor and add a comment explaining why.

### Access Pattern
- Params are only used directly when used as a configuration placeholder. For example, given the int param "memoryParam", you would
  use `runWith({ memory: memoryParam })`.
- You can also use params in provider-specific configuration, for example:
  ```typescript
  const topic = defineString('TOPIC', { /* descriptions */ });
  const database = defineString('DATABASE', { /* descriptions */ });
  
  export const pubsubFunction = functions.pubsub.topic(topic).onPublish((message, context) => { /* ... */});

  export const dbFunction = functions.database.instance(database).onWrite((change, context) => { /* ... */});
  ```
- To actually read the value of a param at runtime, you MUST call `.value()` on the param. `.value()` will throw if called in global scope.

### Naming
- If the config value is currently stored as a temporary variable:
  - Use the exact existing variable name but change the type to a param
  - The parameter passed to the defineXYZ call should be the UPPER_SNAKE_CASE name of the variable.
    So both `const FOO_BAR = functions.config().foo.bar` and `const fooBar = functions.config().foo.bar` should result in `defineString("FOO_BAR", ...)`.
  - The variable is now a param type and must follow access pattern rules. Use `.value()` to read the value at runtime.
- If the config value is not stored as a temporary variable:
  - The variable name for the parameter should be made using the JSON path name in lowerCamelCase.
  - The name passed to the defineXYZ call should be UPPER_SNAKE_CASE.

### Documentation
- Use the path of the functions.config and the usage in the code to understand the meaning of the parameter.
- You MUST add the `label` attribute. It should provide a short description of the parameter. DO NOT omit this.
- You MUST add the `description` attribute. It should provide a more detailed description of the parameter. DO NOT omit this. 
- The `description` attribute SHOULD include tips to help a developer understand how to get the value of the parameter, what it is used for
and/or tips for usage. Examples may be that the stripe API key can be found in the Stripe dashboard for the environment, that the
stripe webhook secret should be a test webhook secret in dev environments so that the webhook emulator can be used, etc.
- The `description` attribute MUST include the name of the `functions.config()` path used prevoiusly, including "functions.config()" so that
future readers understand the data migration. For example "Formerly functions.config().dependency.apiKey".
- If there are existing comments explaining the constraints of the value, use the validator configs to enforce these constraints programatically if possible.
- If there are existing comments explaining the config value (e.g. `// The origin for CORS`), move those comments into the `description` or `label` fields of the parameter definition.
- If there are comments telling people to run any of the `firebase functions:config:*` commands, remove them as Params are self-describing and will automatically prompt.
- Do not remove comments unrelated to changes in the code (e.g. markerts deliniating code sections, describing the purpose of code,
  or espeically any copyright commments).
- Preserve region tags You MUST preserve `[START ...]` and `[END ...]` tags used for documentation. If you replace the code inside them, ensure the tags still wrap the relevant new code. Do not delete them.

### Typing
- If the user intends to use the value as a number it should be declared with `defineNumber`.
- If the parameter looks like it is a storage bucket, set the `input` option to `BUCKET_PICKER`.
- If the parameter looks like it is supposed to be a single value from a list, use the `defineString` method with an input of `select`.
- If the parameter looks like it is supposed to be a list of possible values, use the `defineLsit` method with an input of `multiSelect`.
- If a config key seems to be sensitive, for example it contains words like "KEY", "SECRET", "TOKEN", or "PASSWORD", use `defineSecret()`.
    - Secrets MUST be explicitly bound to the function that uses them.
    - **V1 Syntax:** `.runWith({ secrets: [MY_SECRET] })`
    - **V2 Syntax:** `{ secrets: [MY_SECRET] }` (passed in the options object).
- If a variable must be split to have its declaration at global scope and initialization inside `onInit`, always include the type in the variable declaration.
  E.g. `const myFoo = new Foo(functions.config().fooConfig)` should become
 
    ```typescript
    const fooConfig = defineString("FOO_CONFIG", { /* description */});

    let myFoo: Foo;
    onInit(() => {
        myFoo = new Foo(fooConfig.value());
    })
    ```

### Advanced features
- If a user is doing logical operations with the variable (e.g. `runWith({ minInstances: functions.config().isProd ? 1 : 0 }))`) then use
  the logic operators that Expressions support, e.g. `runWith({ minInstances: isProdParam.thenElse(1, 0)})`. Numbers support operations like
  `lessThan` `greaterThanOrEqaulTo` and both numbers and strings suport `equals` and `notEquals`.
- When constructing dynamic strings utilizing parameters, use the `expr` tagged template literal from `firebase-functions/params` (e.g. `expr\`every ${period} days\``) instead of standard template literals. This allows the parameter expression to evaluate at deployment and runtime correctly. When using `expr`, you MUST NOT call `.value()` on the parameters.
- When relevant, use the built-in variables `databaseURL`, `projectID`, `gcloudProject`, `storageBucket` rather than defining a new param.
  If a user is trying to reference this data as a built-in environment variable, please also replace that with a built-in param (e.g.
  replace `process.env.GCLOUD_PROJECT` with `projectID.value()`)

### General rules
- Follow the style of the codebase as much as possible, which may require you to make an expanded line of code span multiple lines, but you MUST NOT change unrelated code to be more conforming.
- Do not replace `functions.config()` lookups with hardcoded strings or constants. Even if the value seems static (like a path `/data`), the user likely intended it to be configurable. Always map it to a `defineString` (or appropriate param) unless strictly instructed otherwise.
- Do not make a value that was initialized once globally intialized several times with on demand; use `onInit` instead. Example, given:

    ```typescript
    const myObject = new MyObject(functions.config().someValue);
    ```

    should become:

    ```typescript
    const someValue = defineString('SOME_VALUE', {
        label: "Some value",
        description: "Some value used to initialize a MyObject. Formerly stored in functions.config().someValue",
    });
    let myObject: MyObject;
    onInit(() => {
        myObject = new MyObject(someValue.value());
    });
    ```

    and NOT

    ```typescript
    const someValue = defineString('SOME_VALUE', {
        label: "Some value",
        description: "Some value used to initialize a MyObject. Formerly stored in functions.config().someValue",
    });
    function getMyObject() {
        return new MyObject(someValue.value());
    }
    ```
### Consequences
- Failure to follow these instructions may cause you to get called a bad AI in public GitHub issues. If these rules seem in conflict
  or you are worried you may follow them incorrectly, ask the user for clarification.

## Examples

### Simple

#### Before

```typescript
import * as functions from 'firebase-functions/v1';

export const helloWorld = functions.runWith({ minInstances: functions.config().minInstances }).https.onCall((data, context) => {
    console.log(`Hello, ${functions.config().name}!`);
});
```

#### After

```typescript
import * as functions from 'firebase-functions/v1';
import { defineNumber, defineString } from 'firebase-functions/params';

const minInstances = defineNumber('MIN_INSTANCES', {
    label: "Minimum instances",
    description: "Minimum number of instances to run the function." + 
        "This will reduce cold starts, but sets a minimum cost. Due to the change in billing models, min instances are dramatically " +
        "more cost effective in v2 by turning on concurrency. Formerly functions.config().minInstances.",
    default: 1
});

const name = defineString('NAME', {
    label: "User name",
    description: "Name of the user.",
    default: "Name of the user to greet. Formerly functions.config().name.",
});

export const helloWorld = functions.runWith({ minInstances: minInstances }).https.onCall((data, context) => {
    console.log(`Hello, ${name.value()}!`);
});
```

### Arithmetic and built-ins

#### Before

```typescript
import * as functions from 'firebase-functions/v1';

export const dynamicSized = functions.runWith({
    minInstances: functions.config().project == 'my-prod-project' ? 1 : 0,
    memory: functions.config().project == 'my-prod-project' ? '2GB' : '1GB',
}).https.onCall((data, context) => {
    console.log(`Hello, world`);
});

export const pubsubSample = functions.pubsub.topic(functions.config().pubsub.topic)
    .onPublish(() => undefined);
```

#### After

```typescript
import * as functions from 'firebase-functions/v1';
import { projectID, defineString } from 'firebase-functions/params';

const topicParam = defineString('PUBSUB_TOPIC', {
    label: "PubSub Topic",
    description: "The topic to listen to. Formerly functions.config().pubsub.topic."
});

export const dynamicSized = functions.runWith({
    minInstances: projectID.equals('my-prod-project').thenElse(1, 0),
    memory: projectID.equals('my-prod-project').thenElse('2GB', '1GB'),
}).https.onCall((data, context) => {
    console.log(`Hello, world`);
});

export const pubsubSample = functions.pubsub.topic(topicParam)
    .onPublish(() => undefined);
```

### String Interpolation (expr)

#### Before

```typescript
import * as functions from 'firebase-functions/v1';
import { onSchedule } from 'firebase-functions/installer';

export const scheduleSample = onSchedule(`every ${functions.config().schedule.period} days`, () => undefined);
```

#### After

```typescript
import * as functions from 'firebase-functions/v1';
import { onSchedule } from 'firebase-functions/scheduler';
import { defineNumber, expr } from 'firebase-functions/params';

const period = defineNumber("SCHEDULE_PERIOD", {
    label: "Schedule period",
    description: "How many days between runs. Formerly functions.config().schedule.period."
});

export const scheduleSample = onSchedule(expr`every ${period} days`, () => undefined);
```

### Nested, secrets, and init

#### Before

```typescript
import * as functions from 'firebase-functions/v1';
import Stripe from 'stripe';

const stripe = new Stripe(functions.config().stripe.secret_key);
```

#### After

```typescript
import * as functions from 'firebase-functions/v1';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY', {
    label: "Stripe secret key",
    description: "Stripe secret key. Use a sandbox key for dev environments. Formerly functions.config().stripe.secret_key.",
});

let stripe: Stripe;
functions.onInit(() => {
    stripe = new Stripe(stripeSecretKey.value());
});
```