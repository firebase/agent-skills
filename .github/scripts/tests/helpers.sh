#!/bin/bash
# Shared test helpers and assertion functions.
# Counts are stored in temp files so subshells can contribute to the total.

_PASS_FILE=""
_FAIL_FILE=""

init_counters() {
  _PASS_FILE=$(mktemp)
  _FAIL_FILE=$(mktemp)
  echo 0 > "$_PASS_FILE"
  echo 0 > "$_FAIL_FILE"
  export _PASS_FILE _FAIL_FILE
}

_inc_pass() { echo $(($(cat "$_PASS_FILE") + 1)) > "$_PASS_FILE"; }
_inc_fail() { echo $(($(cat "$_FAIL_FILE") + 1)) > "$_FAIL_FILE"; }

pass() {
  echo "  ✓ $1"
  _inc_pass
}

fail() {
  local name="$1"
  local reason="${2:-}"
  echo "  ✗ $name"
  [ -n "$reason" ] && echo "    $reason"
  _inc_fail
}

assert_equals() {
  local expected="$1" actual="$2" name="$3"
  if [ "$expected" = "$actual" ]; then pass "$name"
  else fail "$name" "expected: '$expected'  actual: '$actual'"; fi
}

assert_file_exists() {
  local file="$1" name="$2"
  if [ -f "$file" ]; then pass "$name"
  else fail "$name" "file not found: $file"; fi
}

assert_dir_exists() {
  local dir="$1" name="$2"
  if [ -d "$dir" ]; then pass "$name"
  else fail "$name" "directory not found: $dir"; fi
}

assert_not_exists() {
  local path="$1" name="$2"
  if [ ! -e "$path" ]; then pass "$name"
  else fail "$name" "expected path to not exist: $path"; fi
}

assert_file_contains() {
  local file="$1" pattern="$2" name="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then pass "$name"
  else fail "$name" "pattern '$pattern' not found in $file"; fi
}

print_summary() {
  local suite="$1"
  local passed failed
  passed=$(cat "$_PASS_FILE")
  failed=$(cat "$_FAIL_FILE")
  rm -f "$_PASS_FILE" "$_FAIL_FILE"
  echo ""
  echo "--- $suite ---"
  echo "  Passed: $passed  Failed: $failed"
  [ "$failed" -eq 0 ]
}
