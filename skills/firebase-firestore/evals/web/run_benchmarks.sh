#!/bin/bash
set -euo pipefail

# ==============================================================================
# Multi-Model Benchmark Runner for Firebase Firestore Agent Skill Evals
# ==============================================================================
# Runs the 5 test suites sequentially for:
#   1. Production Gemini Flash (Cloud Code PA backend: --model=flash)
#   2. Gemini 3.5 Flash (Cloud Code PA backend: --model=MODEL_PLACEHOLDER_M149)
#   3. Gemini 3.6 Flash (Cloud Code PA backend: --model=MODEL_PLACEHOLDER_M196)
#
# Evaluation settings:
#   - Evaluates the Firestore skill directly (no with/without ablation comparison)
#   - Executes locally on the current capsule with workspace isolation (--isolate)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../../../../../../.." && pwd)"
SKILL_DIR="${WORKSPACE_ROOT}/third_party/firebase/agent_skills/skills/firebase_firestore"
EVAL_DIR="${SKILL_DIR}/evals/web"
EVALIN="/google/bin/releases/gemini-agents-evalin/evalin"

# Ensure Cloud Code PA URL points directly to prod, bypassing Unleash experiment overrides
export CLOUD_CODE_URL="https://cloudcode-pa.googleapis.com"

echo "========================================================================"
echo "Starting Multi-Model Firebase Firestore Evaluation Battery"
echo "Target directory: ${EVAL_DIR}"
echo "========================================================================"

# ------------------------------------------------------------------------------
# 1. Production Gemini Flash
# ------------------------------------------------------------------------------
echo ""
echo ">>> [1/3] Running Production Gemini Flash..."
"${EVALIN}" run \
  "${EVAL_DIR}" \
  --skills="${SKILL_DIR}" \
  --model=flash \
  --max-parallel=5 \
  --isolate \
  "$@"

# ------------------------------------------------------------------------------
# 2. Gemini 3.5 Flash (Cloud Code PA via MODEL_PLACEHOLDER_M149)
# ------------------------------------------------------------------------------
echo ""
echo ">>> [2/3] Running Gemini 3.5 Flash (Cloud Code PA)..."
"${EVALIN}" run \
  "${EVAL_DIR}" \
  --skills="${SKILL_DIR}" \
  --model=MODEL_PLACEHOLDER_M149 \
  --max-parallel=5 \
  --isolate \
  "$@"

# ------------------------------------------------------------------------------
# 3. Gemini 3.6 Flash (Cloud Code PA via MODEL_PLACEHOLDER_M196)
# ------------------------------------------------------------------------------
echo ""
echo ">>> [3/3] Running Gemini 3.6 Flash (Cloud Code PA)..."
"${EVALIN}" run \
  "${EVAL_DIR}" \
  --skills="${SKILL_DIR}" \
  --model=MODEL_PLACEHOLDER_M196 \
  --max-parallel=5 \
  --isolate \
  "$@"

echo ""
echo "========================================================================"
echo "All 3 evaluation runs completed!"
echo "========================================================================"
