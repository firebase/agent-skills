#!/bin/bash
set -e

# Script to prune deleted Genkit skills
# Usage: ./prune-skills.sh

echo "🧹 Pruning deleted Genkit skills..."

for skill_dir in firebase-skills/skills/*; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  skill_md="$skill_dir/SKILL.md"
  
  # Check if this skill is managed by Genkit
  if [ -f "$skill_md" ]; then
    # We use yq to check the metadata. 
    # The '|| echo false' handles cases where the field is missing or yq fails.
    is_managed=$(yq -f extract '.metadata["genkit-managed"] == true' "$skill_md" 2>/dev/null || echo false)
    
    if [ "$is_managed" = "true" ]; then
      # If managed by Genkit but not in source, delete it
      if [ ! -d "genkit-skills/skills/$skill_name" ]; then
        echo "🗑️ Pruning deleted skill: $skill_name"
        rm -rf "$skill_dir"
      fi
    fi
  fi
done

echo "✅ Pruning complete."
