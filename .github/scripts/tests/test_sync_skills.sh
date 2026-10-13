#!/bin/bash
# Tests for sync-skills.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"

# Writes a mock yq binary into the given directory
make_mock_yq() {
  local bin_dir="$1"
  cat > "$bin_dir/yq" << 'EOF'
#!/bin/bash
# Mock yq: handles -i -f process '...' <file>
if [ "$1" = "-i" ] && [ "$2" = "-f" ] && [ "$3" = "process" ]; then
  shift 4
  file="$1"
  printf '\ngenkit-managed: true\n' >> "$file"
fi
EOF
  chmod +x "$bin_dir/yq"
}

init_counters
echo "Running sync-skills.sh tests..."

# ── Test 1: skill directory is created at destination ─────────────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p genkit-skills/skills/my-skill
  echo "name: my-skill" > genkit-skills/skills/my-skill/SKILL.md
  mkdir -p firebase-skills/skills
  bash "$SCRIPTS_DIR/sync-skills.sh" > /dev/null 2>&1
  assert_dir_exists "$tmpdir/firebase-skills/skills/my-skill" "destination directory is created"
  rm -rf "$tmpdir"
)

# ── Test 2: SKILL.md is copied to destination ─────────────────────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p genkit-skills/skills/my-skill
  echo "name: my-skill" > genkit-skills/skills/my-skill/SKILL.md
  mkdir -p firebase-skills/skills
  bash "$SCRIPTS_DIR/sync-skills.sh" > /dev/null 2>&1
  assert_file_exists "$tmpdir/firebase-skills/skills/my-skill/SKILL.md" "SKILL.md is copied"
  rm -rf "$tmpdir"
)

# ── Test 3: reference files are copied alongside SKILL.md ────────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p genkit-skills/skills/my-skill/references
  echo "content" > genkit-skills/skills/my-skill/SKILL.md
  echo "ref content" > genkit-skills/skills/my-skill/references/guide.md
  mkdir -p firebase-skills/skills
  bash "$SCRIPTS_DIR/sync-skills.sh" > /dev/null 2>&1
  assert_file_exists "$tmpdir/firebase-skills/skills/my-skill/references/guide.md" "reference files are copied"
  rm -rf "$tmpdir"
)

# ── Test 4: yq is called to tag the skill as genkit-managed ──────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p genkit-skills/skills/my-skill
  echo "name: my-skill" > genkit-skills/skills/my-skill/SKILL.md
  mkdir -p firebase-skills/skills
  bash "$SCRIPTS_DIR/sync-skills.sh" > /dev/null 2>&1
  assert_file_contains "$tmpdir/firebase-skills/skills/my-skill/SKILL.md" "genkit-managed" "yq tags skill as genkit-managed"
  rm -rf "$tmpdir"
)

# ── Test 5: stale files at destination are removed before sync ───────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  mkdir -p genkit-skills/skills/my-skill
  echo "content" > genkit-skills/skills/my-skill/SKILL.md
  mkdir -p firebase-skills/skills/my-skill
  echo "stale" > firebase-skills/skills/my-skill/old-file.md
  bash "$SCRIPTS_DIR/sync-skills.sh" > /dev/null 2>&1
  assert_not_exists "$tmpdir/firebase-skills/skills/my-skill/old-file.md" "stale destination files are removed"
  rm -rf "$tmpdir"
)

# ── Test 6: multiple skills are all synced ───────────────────────────────────
(
  tmpdir=$(mktemp -d)
  make_mock_yq "$tmpdir"
  cd "$tmpdir"
  export PATH="$tmpdir:$PATH"
  for skill in skill-a skill-b skill-c; do
    mkdir -p "genkit-skills/skills/$skill"
    echo "name: $skill" > "genkit-skills/skills/$skill/SKILL.md"
  done
  mkdir -p firebase-skills/skills
  bash "$SCRIPTS_DIR/sync-skills.sh" > /dev/null 2>&1
  assert_dir_exists "$tmpdir/firebase-skills/skills/skill-a" "first skill synced"
  assert_dir_exists "$tmpdir/firebase-skills/skills/skill-b" "second skill synced"
  assert_dir_exists "$tmpdir/firebase-skills/skills/skill-c" "third skill synced"
  rm -rf "$tmpdir"
)

print_summary "sync-skills.sh"
