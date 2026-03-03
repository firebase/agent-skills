---
name: extension-to-functions-codebase
description: Skill for converting an extensions repository to a functions codebase
---

# Extension to Functions Codebase

## Overview

A user likes a Firebase Extension but it doesn't do exactly what they wanted. They
want to convert the extension into a functions codebase that they can modify and
deploy as their own functions. The only problem is that the extensions namespace
doesn't express any of the IaC expected in extensions. This fixes taht.

## Triggerrs
Activate this skill when a developer expresses that they which an extension was
a functions codebase instead of an extension.

## Follow up
If there are any tests in the extensions codebase, be sure to run them after the migration.

## Rules and Constraints

# Verify you are ready for the task
If an extensions codebase has a feature that you do not know how to handle yet, such as
lifecycle hooks, panic and tell the user that you cannot handle this task yet.

# API Enablement
For all API dependencies listed in `extension.yaml`, add a comment to index.js

```typescript
// APIs to enable: 
// - 
```

# Parameterization
All config must be a parameter in the functions codebase. Read the list of all
parameters in the extension's `extension.yaml` file and create a parameter for each
one in the functions codebase. Be sure to keep all metadata such as label, description, type, and
valation rules and error messages. All process.env calls must be instead replaced with the
appropriate param.value() call. Be sure all process.env values referenced are defined as parameters;
be encouraged to use built-in parameters though.

Custom events should be listed as a multiSelect parameter. For the label should be "Events to emit".
The description should be "Select the events that this function should emit from the following list:"
and then list events as options with `*[type]*: [description]\n`. The event type should be the value
in the multiSelect input list.

params must not be called with .value() at global scope. If a global is being intialized with a
parameter, use the onInit function to initialize the global. For example:

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

Never ever ever export an extension's value directly or even an accessor, even through a function. If the codebase used to use an export default, be sure to update the import to an `import * as config from` instead of `import config from` style. 
Instead export the parameter as a named export from any library codebase. This allows you to use
the parameter without .value() as a functions configuration parameter in the later step. On the other hand, within a function, you may call .value() on the parameter if you need to actually use the value of the parameter.

# Engine pinning
In `extensions.yaml` there will be a line that looks like this:

```yaml
runtime: nodejs20
```

This means that the extension is pinned to a specific runtime. If all functions
do not have the same runtime, panic and tell the user that mixed runtimes are
not yet supported.

Learn the runtime and use that to update the customer's package.json to list the
node engine as the runtime version.

# Switching SDK versions
For all exported functions, replace the import with "functions.extensions.foo" to just
"functions.foo". Use the other builder functions necessary to reach the same function
callback. Where those builder functions expect or allow a parameter, use the named functions
parameter for the configuration.

# Wrapping up
If the destination directory looks like a firebase project (e.g. has a firebase.json) Offer
to the functions codebase to firebase.json for the user so that it will be included
in subsequent deploys. If the user agrees, add the functions codebase to firebase.json.

# Testing
If there are any tests in the extensions codebase, be sure to run them after
the migration. This may require modifying the test as well to point to the functions codebase.