#!/bin/bash
set -e

# Script to sync and tag Genkit skills
# Usage: ./sync-skills.sh

echo "🔄 Syncing skills from Genkit repo..."

for skill_dir in genkit-skills/skills/*; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  dest_dir="firebase-skills/skills/$skill_name"
  
  echo "📦 Syncing $skill_name..."
  
  # Clean destination to ensure exact sync (remove old files)
  if [ -d "$dest_dir" ]; then
    rm -rf "$dest_dir"
  fi
  mkdir -p "$dest_dir"
  
  # Copy new files
  cp -r "$skill_dir/"* "$dest_dir/"
  
  # Mark as managed by Genkit using yq
  # The -i flag edits in place, -f process runs the filter
  yq -i -f process '.metadata["genkit-managed"] = true' "$dest_dir/SKILL.md"
done

echo "✅ Sync complete."
