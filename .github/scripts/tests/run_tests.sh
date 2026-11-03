#!/bin/bash
# Entry point: runs all shell script test suites
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OVERALL_FAILED=0

run_suite() {
  local suite_script="$1"
  bash "$suite_script"
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    OVERALL_FAILED=$((OVERALL_FAILED + 1))
  fi
}

echo "========================================"
echo "  Shell Script Test Suite"
echo "========================================"
echo ""

run_suite "$SCRIPT_DIR/test_sync_skills.sh"
echo ""
run_suite "$SCRIPT_DIR/test_prune_skills.sh"

echo ""
echo "========================================"
if [ "$OVERALL_FAILED" -gt 0 ]; then
  echo "  RESULT: $OVERALL_FAILED suite(s) FAILED"
  echo "========================================"
  exit 1
else
  echo "  RESULT: All suites passed"
  echo "========================================"
fi
