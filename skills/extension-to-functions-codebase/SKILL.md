---
name: extension-to-functions-codebase
description: Skill for converting a Firebase extension repository to a functions codebase
---

# Extension to Functions Codebase

## Overview

A user likes a Firebase Extension but it doesn't do exactly what they wanted. They
want to convert the extension into a functions codebase that they can modify and
deploy as their own functions. The only problem is that the extensions namespace
doesn't express any of the Infrastructure as Code expected in extensions. This fixes that.

## Triggers
Activate this skill when a developer expresses that they wish an extension was
a functions codebase instead of an extension.

## Follow up
If there are any tests in the extensions codebase, be sure to run them after the migration.

## Rules and Constraints

### Verify you are ready for the task
If an extensions codebase has a feature that you do not know how to handle 
yet, such as lifecycle hooks or specific IAM roles via `iamRoles` in
`extension.yaml`, stop and tell the user that you cannot handle this task 
yet.  Let them decide whether or not to continue.

### Avoid contention
When possible, avoid using the `firebase` cli, or firebase MCP server to avoid global contention. Try
to inspect `extension.yaml` and code manually.

## Getting started
Make sure the git history is clean before proceeding because this skill uses commits.

The user may do one of two things: ask you to convert extensions code in-place or ask you to creeate a new copy of the
extensions code. If they do the former, and the destination is in the same directory as the source, use git cp of the
code to the new location and commit with the message "Copying [extension] extension to [directory] in preparation for rewrite".

## Steps

### API Enablement
For all API dependencies listed in `extension.yaml`, add a comment to index.js and inform the user in your final response to manually enable them.

```typescript
// APIs to enable: 
// - vision.googleapis.com 
```

### Parameterization
All config must be a parameter in the functions codebase. Read the list of all
parameters in the extension's `extension.yaml` file and create a parameter for each
one in the functions codebase. Be sure to keep all metadata such as label, description, type, and
validation rules and error messages. If a parameter's type is `secret`, use `defineSecret('SECRET_NAME')` instead of `defineString`.
All `process.env` calls must be instead replaced with the
appropriate `param.value()` call. Be sure all `process.env` values referenced are defined as parameters;
be encouraged to use built-in parameters though.

Custom events should be listed as a `multiSelect` parameter with the label "Events to emit".
The description should be "Select the events that this function should emit from the following list:"
and then list events as options with `*[type]*: [description]\n`. The event type should be the value
in the `multiSelect` input list.

`params` must not be called with `.value()` at global scope. If a global is being initialized with a
parameter, use the `onInit` function to initialize the global. For example:

```typescript
const myFoo = new Foo(process.env.FOO);
```

should be turned into

```typescript
const foo = defineString('FOO', { /* descriptions */ });
let myFoo: Foo;
onInit(() => {
  myFoo = new Foo(foo.value());
});
```

Never ever ever export an extension parameter's value directly or even an accessor, even through a function. This allows you to use
the parameter without `.value()` as a functions configuration parameter in the later step. On the other hand, within a function, you may call `.value()` on the parameter if you need to actually use the value of the parameter.

### Engine pinning
In `extension.yaml` there will be a line that looks like this:

```yaml
runtime: nodejs20
```

This means that the extension is pinned to a specific runtime. If all functions
do not have the same runtime, stop and tell the user that mixed runtimes are
not yet supported.

Learn the runtime and use that to update the customer's package.json to list the
node engine as the runtime version.

### Switching SDK versions
For all exported functions, replace the import with "functions.extensions.foo" to just
"functions.foo". Use the other builder functions necessary to reach the same function
callback. Where those builder functions expect or allow a parameter, use the named functions
parameter for the configuration.

### Wrapping up
If the destination directory looks like a firebase project (e.g. has a `firebase.json`) Offer
to add the functions codebase to `firebase.json` for the user so that it will be included
in subsequent deploys. If the user agrees, add the functions codebase to `firebase.json`.

### Testing
If there are any tests in the extensions codebase, be sure to run them after
the migration. This may require modifying the test as well to point to the functions codebase.