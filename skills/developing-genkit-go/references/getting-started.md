# Getting Started

## Project Setup

```bash
mkdir my-genkit-app && cd my-genkit-app
go mod init my-genkit-app
go get github.com/genkit-ai/genkit/go@latest
```

Add provider plugin(s) for the models you want to use:
```bash
go get github.com/genkit-ai/genkit/go/plugins/googlegenai  # Google AI / Vertex AI
go get github.com/genkit-ai/genkit/go/plugins/anthropic     # Anthropic Claude
go get github.com/genkit-ai/genkit/go/plugins/compat_oai    # OpenAI-compatible
go get github.com/genkit-ai/genkit/go/plugins/ollama        # Ollama (local)
```

After writing your code, run `go mod tidy` to resolve all dependencies.

## Initialization

Every Genkit app starts with `genkit.Init`, which returns a `*Genkit` instance:

```go
import (
	"context"
	"github.com/genkit-ai/genkit/go/genkit"
	"github.com/genkit-ai/genkit/go/plugins/googlegenai"
)

ctx := context.Background()
g := genkit.Init(ctx,
	genkit.WithPlugins(&googlegenai.GoogleAI{}),
)
```

### The `*Genkit` Instance

The `*Genkit` value `g` is the central registry. Pass it to every Genkit function:

```go
// Defining resources
genkit.DefineFlow(g, "myFlow", ...)
genkit.DefineTool(g, "myTool", ...)
genkit.DefinePrompt(g, "myPrompt", ...)

// Generating content
genkit.GenerateText(ctx, g, ...)
genkit.Generate(ctx, g, ...)
```

Do not store `g` in a global variable. Pass it explicitly through your call chain.

### Init Options

```go
g := genkit.Init(ctx,
	// Register one or more plugins
	genkit.WithPlugins(&googlegenai.GoogleAI{}, &anthropic.Anthropic{}),

	// Set a default model (used when no model is specified)
	genkit.WithDefaultModel("googleai/gemini-flash-latest"),

	// Set directory for .prompt files (default: "prompts")
	genkit.WithPromptDir("my-prompts"),

	// Or embed prompts using Go's embed package
	// genkit.WithPromptFS(promptsFS),
)
```

### Embedding Prompts

Use `go:embed` to bundle `.prompt` files into the binary:

```go
//go:embed prompts
var promptsFS embed.FS

g := genkit.Init(ctx,
	genkit.WithPlugins(&googlegenai.GoogleAI{}),
	genkit.WithPromptFS(promptsFS),
)
```

## Genkit CLI

The Genkit CLI provides a local Developer UI for running flows, tracing executions, and inspecting model interactions.

**Install:**
```bash
curl -sL cli.genkit.dev | bash
```

**Verify:**
```bash
genkit --version
```

### Developer UI

Start your app with the Developer UI attached:

```bash
genkit start -- go run .
```

This launches:
- Your app (with tracing enabled)
- The Developer UI at `http://localhost:4000`
- A telemetry API at `http://localhost:4033`

Add `-o` to auto-open the UI in your browser:
```bash
genkit start -o -- go run .
```

The Developer UI lets you:
- Run and test flows interactively
- View traces for each generation call (inputs, outputs, latency, token usage)
- Inspect prompt rendering and tool calls
- Debug multi-step flows with per-step trace data

### Without the CLI

Set `GENKIT_ENV=dev` to enable the reflection API without the CLI:

```bash
GENKIT_ENV=dev go run .
```

## Import Paths

```go
import (
	"github.com/genkit-ai/genkit/go/genkit"          // Core: Init, Generate*, DefineFlow, etc.
	"github.com/genkit-ai/genkit/go/ai"              // Types: WithModel, WithPrompt, Message, Part, etc.
	"github.com/genkit-ai/genkit/go/core"            // Low-level: Run (sub-steps), Flow types
	"github.com/genkit-ai/genkit/go/plugins/server"  // server.Start for HTTP
)
```
