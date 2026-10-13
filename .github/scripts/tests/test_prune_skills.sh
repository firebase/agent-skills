#!/bin/bash
# Tests for prune-skills.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"

# Writes a mock yq that returns "true"/"false" based on file content
make_mock_yq() {
  local bin_dir="$1"
  cat > "$bin_dir/yq" << 'EOF'
#!/bin/bash
if [ "$1" = "-f" ] && [ "$2" = "extract" ]; then
  file="$4"
  if grep -q "genkit-managed: true" "$file" 2>/dev/null; then
    echo "true"
  else
    echo "false"
  fi
fi
EOF
  chmod +x "$bin_dir/yq"
}

init_counters
echo "Running prune-skills.sh tests..."

# ── Test 1: genkit-managed skill absent from source is deleted ────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p firebase-skills/skills/deleted-skill
  printf -- '---\nmetadata:\n  genkit-managed: true\n---\n' > firebase-skills/skills/deleted-skill/SKILL.md
  mkdir -p genkit-skills/skills
  bash "$SCRIPTS_DIR/prune-skills.sh" > /dev/null 2>&1
  assert_not_exists "$tmpdir/firebase-skills/skills/deleted-skill" "orphaned genkit-managed skill is pruned"
  rm -rf "$tmpdir"
)

# ── Test 2: genkit-managed skill present in source is kept ───────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p firebase-skills/skills/kept-skill
  printf -- '---\nmetadata:\n  genkit-managed: true\n---\n' > firebase-skills/skills/kept-skill/SKILL.md
  mkdir -p genkit-skills/skills/kept-skill
  bash "$SCRIPTS_DIR/prune-skills.sh" > /dev/null 2>&1
  assert_dir_exists "$tmpdir/firebase-skills/skills/kept-skill" "active genkit-managed skill is kept"
  rm -rf "$tmpdir"
)

# ── Test 3: non-genkit-managed skill is never pruned ─────────────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p firebase-skills/skills/local-skill
  printf -- '---\nname: local-skill\n---\n' > firebase-skills/skills/local-skill/SKILL.md
  mkdir -p genkit-skills/skills
  bash "$SCRIPTS_DIR/prune-skills.sh" > /dev/null 2>&1
  assert_dir_exists "$tmpdir/firebase-skills/skills/local-skill" "non-managed skill is never pruned"
  rm -rf "$tmpdir"
)

# ── Test 4: skill directory without SKILL.md is left untouched ───────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p firebase-skills/skills/no-skill-md
  mkdir -p genkit-skills/skills
  bash "$SCRIPTS_DIR/prune-skills.sh" > /dev/null 2>&1
  assert_dir_exists "$tmpdir/firebase-skills/skills/no-skill-md" "directory without SKILL.md is left alone"
  rm -rf "$tmpdir"
)

# ── Test 5: multiple orphaned managed skills are all pruned ──────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  for skill in orphan-a orphan-b; do
    mkdir -p "firebase-skills/skills/$skill"
    printf -- '---\nmetadata:\n  genkit-managed: true\n---\n' > "firebase-skills/skills/$skill/SKILL.md"
  done
  mkdir -p genkit-skills/skills
  bash "$SCRIPTS_DIR/prune-skills.sh" > /dev/null 2>&1
  assert_not_exists "$tmpdir/firebase-skills/skills/orphan-a" "first orphaned skill is pruned"
  assert_not_exists "$tmpdir/firebase-skills/skills/orphan-b" "second orphaned skill is pruned"
  rm -rf "$tmpdir"
)

# ── Test 6: only the managed orphan is pruned when mixed with local skills ────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p firebase-skills/skills/managed-orphan
  printf -- '---\nmetadata:\n  genkit-managed: true\n---\n' > firebase-skills/skills/managed-orphan/SKILL.md
  mkdir -p firebase-skills/skills/local-skill
  printf -- '---\nname: local\n---\n' > firebase-skills/skills/local-skill/SKILL.md
  mkdir -p genkit-skills/skills
  bash "$SCRIPTS_DIR/prune-skills.sh" > /dev/null 2>&1
  assert_not_exists "$tmpdir/firebase-skills/skills/managed-orphan" "managed orphan is pruned"
  assert_dir_exists "$tmpdir/firebase-skills/skills/local-skill" "unmanaged skill is preserved"
  rm -rf "$tmpdir"
)

print_summary "prune-skills.sh"
