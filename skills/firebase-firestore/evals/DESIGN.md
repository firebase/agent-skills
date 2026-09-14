# Multi-SDK Firestore Evaluation Architecture Design

## 1. Overview & Objectives

This design establishes a unified, cross-platform **Eval-Driven Development
(EDD)** framework for the `firebase-firestore` agent skill. The objective is to
provide exhaustive, reproducible benchmarks that validate agent competency
across all Firestore SDK surfaces:

1.  **Web SDK** (Modular JavaScript/TypeScript `@firebase/firestore` via NPM)
2.  **Android SDK** (`com.google.firebase:firebase-firestore` via Gradle/Maven)
3.  **iOS SDK** (`FirebaseFirestore` via Swift Package Manager / CocoaPods)

### Phased Execution Strategy

-   **Phase 1 (Active Implementation)**: Implements complete evaluation suites
    and deterministic compilation validators for the **Modular Web SDK via NPM**
    using open-source Node.js tooling.
-   **Phase 2 (Future Extension)**: Implements Android and iOS SDK evaluation
    suites as specialized build tooling and containerized harnesses become
    available on developer environments. This phase will also require
    refactoring and porting the evaluation suites to be language-specific
    (Kotlin/Java and Swift).

--------------------------------------------------------------------------------

## 2. Target Evaluation Capability Domains

The evaluation suite validates agent competency across core Firestore behavioral
capabilities, which are semantically consistent across all client SDKs:

<!-- mdformat off(prevent multiline table wrapping to avoid critique rendering bugs) -->
| Capability Domain | Target Capabilities & Evaluated Behaviors |
| :--- | :--- |
| **1. Classic CRUD** | Document creation, point reads, partial updates with merge, deletions, and auto-generated IDs |
| **2. Atomic Transactions & Batches** | Multi-document atomic writes, transactions with strict read-before-write invariants |
| **3. Real-Time Snapshot Listeners** | Document and collection change listeners, unsubscribe lifecycles, and granular change delta processing |
| **4. Offline & Cache Persistence** | Cache configuration, offline persistence settings, and cache-first query policies |
| **5. FieldValue Transforms** | Server timestamps, numeric increments, array union/remove, and field deletion markers |
| **6. Enterprise Pipeline API** | Chained query pipelines: collection source, server-side filtering, projection, limits, and scalar expressions |
| **7. Vector Search & Similarity** | K-nearest neighbors similarity search using vector distance measures (cosine, dot product, euclidean) |
| **8. Full-Text Search (FTS)** | Document text search with relevance ranking, score sorting, and phrase matching |
| **9. Pipeline DML Stages** | Server-side bulk mutations: pipeline-driven insert, upsert, update, and delete |
| **10. Edition-Aware Routing** | Detection of Standard vs. Enterprise database editions, enforcing `--edition="enterprise"` provisioning |
| **11. Security Rules & Types** | Paired schema rules, granular operation permissions, authentication guards, and negative anti-churn rejection |
<!-- mdformat on -->

--------------------------------------------------------------------------------

## 3. Modular Suite Layout

Suites are structured modularly under
`third_party/firebase/agent_skills/skills/firebase_firestore/evals/`:

```
evals/
├── DESIGN.md                     # Cross-SDK evaluation architecture design
└── web/                          # Modular Web SDK (JavaScript / TypeScript) evaluation suites
    ├── run_benchmarks.sh         # Multi-model evaluation benchmark runner
    ├── classic_sdk/
    │   └── EVAL.txtpb            # Classic Web SDK CRUD, Transactions, Queries, Indexes, FieldValues
    ├── pipeline_api/
    │   └── EVAL.txtpb            # Enterprise Pipeline API stages, Joins, DML, Vector search
    ├── edition_routing/
    │   └── EVAL.txtpb            # Standard vs Enterprise edition detection and CLI commands
    ├── security_rules/
    │   └── EVAL.txtpb            # Data type security rules and anti-vibe-coding negative tests
    ├── fixtures/                 # Reusable client test project staged by evalin
    │   ├── package.json          # NPM dependencies manifest (firebase v12+, typescript)
    │   ├── tsconfig.json         # TypeScript configuration for SDK compile tests
    │   ├── setup_node_modules.sh # Capsule harness initialization (Airlock proxy + node_modules)
    │   ├── firebase.json         # Firebase Emulator Suite configuration
    │   └── firestore.rules       # Base emulator security rules
    └── validators/               # Reusable validation scripts
        └── validate_package_json.js # Package.json dependency & registry validator
```

--------------------------------------------------------------------------------

## 4. Evaluation Runtime Architecture

### A. Strict Open-Source Tooling Boundary

During evaluation execution, evaluated agents and test harnesses run inside an
isolated CitC workspace / environment. The agents must interact **only with
open-source tools**:

Evaluated agents must **NEVER** import or reference google3-internal libraries
(e.g. `//third_party/firebase/...` or internal Piper paths).

#### 1. Web SDK Tooling (Active - Phase 1)

-   **Package Manager**: `npm` / `npx`
-   **Dependencies**: `@firebase/firestore`, `firebase`
-   **Runtime**: Node.js (v18+)
-   **Compilation / Typechecking**: `tsc` (TypeScript compiler)
-   **Test Project Fixtures**: The `web/fixtures/` directory contains a minimal,
    pre-configured client test project (`package.json`, `tsconfig.json`,
    `firebase.json`, `firestore.rules`). During suite setup (`setup.files` in
    `EVAL.txtpb`), `evalin` copies these fixture files directly to the root of
    the evaluation workspace. The pre-warmed dependencies staged in
    `/tmp/firestore_eval_harness/node_modules` are then symlinked to
    `./node_modules`, providing evaluated agents with a realistic, immediately
    compilable customer project environment without per-case `npm install`
    overhead.

#### 2. Android SDK Tooling (Placeholder - Phase 2)

-   **Package Manager**: Gradle / Maven
-   **Dependencies**: `com.google.firebase:firebase-firestore`
-   **Runtime / Language**: Kotlin / Java
-   **Compilation**: `./gradlew compileDebugKotlin`

#### 3. iOS SDK Tooling (Placeholder - Phase 2)

-   **Package Manager**: Swift Package Manager (SPM) / CocoaPods
-   **Dependencies**: `FirebaseFirestore`
-   **Runtime / Language**: Swift
-   **Compilation**: `swift build` / `xcodebuild`

--------------------------------------------------------------------------------

## 5. Hybrid Grading Pipeline

Every evaluation case combines two complementary scoring layers:

```
                  +-----------------------------------------+
                  |           Agent Trajectory              |
                  +-----------------------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
     +---------------------------+           +---------------------------+
     |   Deterministic Script    |           |    LLM Judge Reasoning    |
     |        Validators         |           |       Expectations        |
     +---------------------------+           +---------------------------+
     | - TypeScript compilation  |           | - Architectural intent    |
     | - Package / syntax checks |           | - Correct pattern choice  |
     |                           |           | - Non-sycophantic verdict |
     +---------------------------+           +---------------------------+
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
                         +---------------------------+
                         |  Final Binary Case Result |
                         |       (PASS / FAIL)       |
                         +---------------------------+
```

1.  **Deterministic Script Validators (`script_validators`)**:
    -   **Fail-Fast Compilation Invariant**: Evaluations compile agent-generated
        code using language-specific compiler tooling against real SDK type
        definitions. If compilation fails or referenced APIs/types do not exist
        in the real SDK, the validator immediately exits with a non-zero code
        (e.g., exit 2) and `evalin` fails the case.
    -   **Web SDK (Active - Phase 1)**:
        -   Compiles agent-generated code against real `@firebase/firestore`
            type definitions via `npx tsc --noEmit`.
        -   Executes validation against dependencies staged in
            `/tmp/firestore_eval_harness` (initialized once per suite via
            `setup_node_modules.sh`).
        -   Validates `package.json` dependencies and registry configuration via
            `web/validators/validate_package_json.js`.
    -   **Phase 2 Runtime Validation & Emulator Synergy**:
        -   While Phase 1 uses hermetic type/API signature verification via `npx
            tsc --noEmit` to provide rapid feedback without network overhead,
            Phase 2 will introduce dynamic execution against local Firestore
            Emulator instances with pre-seeded data fixtures.
        -   Security rules evaluation will converge with the automated
            evaluation framework in `cl/971533198`
            (`rules_eval/firestore_rules_evaluator.py`), sharing emulator test
            synthesis and Red-Team audit tooling once that CL lands.
    -   **Android SDK (Placeholder - Phase 2)**: Compiles Kotlin/Java source
        snippets against the staged Android SDK artifact using `./gradlew
        compileDebugKotlin`.
    -   **iOS SDK (Placeholder - Phase 2)**: Compiles Swift source snippets
        against the staged Swift package using `swift build` or `xcodebuild`.
2.  **LLM Judge Expectations (`expectations`)**:
    -   Assesses adherence to design patterns (e.g. avoiding client-side
        filtering when pipelines are required, ensuring required error
        handling).
    -   Validates anti-churn negative assertions (e.g. verifying the agent did
        not emit unsupported App Check rules syntax).

--------------------------------------------------------------------------------

## 6. Benchmarking & Multi-Model Execution Runbook

To benchmark agent performance across model generations while avoiding rate
limits (`429 RESOURCE_EXHAUSTED`) and capacity drops (`503 UNAVAILABLE`), use
the runbook below.

### Capsule Environment Setup

To deploy a dedicated team agent capsule pre-configured for Firestore client
evaluations, run:

```bash
blaze run //experimental/users/markduckworth/marina/firestore_clients_eval_test:deploy
```

> [!IMPORTANT] **Local Capsule Execution**: All commands below are configured to
> run strictly on the **current capsule** (without dispatching tasks to remote
> worker pools, `--pool`, or `--replicas`).
>
> **Workspace Isolation (`--isolate`)**: Always include the `--isolate` flag
> when executing multi-case suites locally. This ensures that every evaluation
> case runs in its own ephemeral CitC workspace clone on the capsule, preventing
> uncompiled or invalid TypeScript files in one test case from
> cross-contaminating and breaking `tsc` across other cases.

### Model Backend: Cloud Code PA (Internal Language Server)

All model executions and historical model ablations route through internal
**Cloud Code PA / Antigravity Language Server** infrastructure:

-   **Dedicated Capacity & Zero Rate Limits**: Requests execute against internal
    production capacity (`model_api_client_type=ccpa`,
    `request_criticality=CRITICAL`). This completely avoids external AI Studio
    rate limits (1M TPM quota / 15 RPM) and unauthenticated Beyond API sheddable
    queue drops (`qos=SHEDDABLE`), without requiring any external API key.
-   **Model Enum Identifiers**: `evalin` natively accepts model proto enum
    values defined in `enum Model` inside
    [`codeium_common.proto`](file:///google3/third_party/jetski/codeium_common_pb/codeium_common.proto)
    (`//depot/google3/third_party/jetski/codeium_common_pb/codeium_common.proto`).
    Passing these recognized enum names (such as `MODEL_PLACEHOLDER_M149` for
    `gemini-3.5-flash`) sets `is_custom=False`, directing traffic straight
    through Cloud Code PA with full parallelism (`--max-parallel=5`).
-   **Endpoint Configuration**: Always set `export
    CLOUD_CODE_URL="https://cloudcode-pa.googleapis.com"` in your environment to
    ensure requests hit production Cloud Code PA and bypass sandbox/preprod
    Unleash experiment overrides.

--------------------------------------------------------------------------------

### Execution Commands (Current Capsule Only)

#### 1. Production Gemini Flash (Default Internal Backend)

Runs locally on the current capsule via internal Cloud Code PA infrastructure
with controlled concurrency (`--max-parallel=5`) and workspace isolation:

```bash
export CLOUD_CODE_URL="https://cloudcode-pa.googleapis.com"

/google/bin/releases/gemini-agents-evalin/evalin run \
  third_party/firebase/agent_skills/skills/firebase_firestore \
  --with-vs-without-skills \
  --skills=third_party/firebase/agent_skills/skills/firebase_firestore \
  --model=flash \
  --max-parallel=5 \
  --isolate
```

#### 2. Gemini 3.5 Flash (Ablation via Cloud Code PA)

Runs locally on the current capsule via internal Cloud Code PA using the
`MODEL_PLACEHOLDER_M149` proto enum from `codeium_common.proto` with controlled
concurrency (`--max-parallel=5`) and workspace isolation:

```bash
export CLOUD_CODE_URL="https://cloudcode-pa.googleapis.com"

/google/bin/releases/gemini-agents-evalin/evalin run \
  third_party/firebase/agent_skills/skills/firebase_firestore \
  --with-vs-without-skills \
  --skills=third_party/firebase/agent_skills/skills/firebase_firestore \
  --model=MODEL_PLACEHOLDER_M149 \
  --max-parallel=5 \
  --isolate
```

#### 3. Targeted Single Suite & Case Verification (Fast Feedback)

To test a single suite or specific test case locally on the current capsule:

```bash
# Run a specific case
/google/bin/releases/gemini-agents-evalin/evalin run \
  third_party/firebase/agent_skills/skills/firebase_firestore/evals/web/classic_sdk/EVAL.txtpb \
  --case web_sdk_transactions_and_field_values \
  --isolate

# Dry-run suite parsing and setup verification (no model calls or quota consumed)
/google/bin/releases/gemini-agents-evalin/evalin run \
  third_party/firebase/agent_skills/skills/firebase_firestore/EVAL.txtpb \
  --dry-run
```
