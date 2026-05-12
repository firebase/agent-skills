---
name: developing-genkit-dart
description: "Generates code for Genkit flows, configures model plugins, sets up tool definitions, and provides documentation for the Genkit Dart SDK. Use when the user asks to build AI agents in Dart, create Genkit flows, define tools, configure model providers, or integrate LLMs into Dart/Flutter applications."
metadata:
  genkit-managed: true
---

# Genkit Dart

Genkit Dart is an AI SDK for Dart that provides a unified interface for code generation, structured outputs, tools, flows, and AI agents.

## Quick Start

```dart
import 'package:genkit/genkit.dart';
import 'package:genkit_google_genai/genkit_google_genai.dart';

void main() async {
  final ai = Genkit(plugins: [googleAI()]);

  final response = await ai.generate(
    model: googleAI.gemini('gemini-2.5-flash'),
    prompt: 'Explain quantum computing in simple terms.',
  );

  print(response.text);
}
```

## Core Features and Usage
For initializing Genkit (`Genkit()`), Generation (`ai.generate`), Tooling (`ai.defineTool`), Flows (`ai.defineFlow`), Embeddings (`ai.embedMany`), streaming, or calling remote flow endpoints, load the core framework reference:
[references/genkit.md](references/genkit.md)

## Genkit CLI (recommended)

The Genkit CLI provides a local development UI for running Flow, tracing executions, playing with models, and evaluating outputs.

check if the user has it installed: `genkit --version`

**Installation:**
```bash
curl -sL cli.genkit.dev | bash # Native CLI
# OR
npm install -g genkit-cli # Via npm
```

**Usage:**
Wrap your run command with `genkit start` to attach the Genkit developer UI and tracing:
```bash
genkit start -- dart run main.dart
```

## Plugin Ecosystem
Genkit relies on a large suite of plugins to perform generative AI actions, interface with external LLMs, or host web servers.

When asked to use any given plugin, always verify usage by referring to its corresponding reference below. You should load the reference when you need to know the specific initialization arguments, tools, models, and usage patterns for the plugin:

| Plugin Name | Reference Link | Description |
| ---- | ---- | ---- |
| `genkit_google_genai` | [references/genkit_google_genai.md](references/genkit_google_genai.md) | Load for Google Gemini plugin interface usage. |
| `genkit_anthropic` | [references/genkit_anthropic.md](references/genkit_anthropic.md) | Load for Anthropic plugin interface for Claude models. |
| `genkit_openai` | [references/genkit_openai.md](references/genkit_openai.md) | Load for OpenAI plugin interface for GPT models, Groq, and custom compatible endpoints. |
| `genkit_middleware` | [references/genkit_middleware.md](references/genkit_middleware.md) | Load for Tooling for specific agentic behavior: `filesystem`, `skills`, and `toolApproval` interrupts. |
| `genkit_mcp` | [references/genkit_mcp.md](references/genkit_mcp.md) | Load for Model Context Protocol integration (Server, Host, and Client capabilities). |
| `genkit_chrome` | [references/genkit_chrome.md](references/genkit_chrome.md) | Load for Running Gemini Nano locally inside the Chrome browser using the Prompt API. |
| `genkit_shelf` | [references/genkit_shelf.md](references/genkit_shelf.md) | Load for Integrating Genkit Flow actions over HTTP using Dart Shelf. |
| `genkit_firebase_ai` | [references/genkit_firebase_ai.md](references/genkit_firebase_ai.md) | Load for Firebase AI plugin interface (Gemini API via Vertex AI). |

## External Dependencies
Tools, Flows, and Prompts that define schemas require the [schemantic](https://pub.dev/packages/schemantic) library. Load [references/schemantic.md](references/schemantic.md) when you encounter `@Schema()`, `SchemanticType`, or classes with the `$` prefix. Run `dart run build_runner build` after any schema change to regenerate `.g.dart` files.

## Key Guidance
- **Use schemantic for all schemas.** Genkit Dart uses schemantic for typed data models across tools, flows, and prompts. Always define schemas with `@Schema()` on abstract classes with `$` prefix and regenerate with `dart run build_runner build`.
- **Verify before responding.** Run `dart analyze` to confirm code compiles cleanly before generating the final response.
- **Use the Genkit CLI for local development.** Start with `genkit start -- dart run main.dart` to get the Developer UI with tracing, flow testing, and model evaluation at http://localhost:4000.
- **Write clear tool descriptions.** The model selects tools based on the `description` parameter in `ai.defineTool`. Vague descriptions lead to missed or incorrect tool calls.
- **Load plugin references before using them.** Each plugin has specific initialization arguments and usage patterns. Always check the corresponding reference file from the Plugin Ecosystem table before writing plugin code.
