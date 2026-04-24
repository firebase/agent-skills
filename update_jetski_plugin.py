#!/usr/bin/env python3
"""Script to zip firebase agent skills and add to gstatic."""

import argparse
import hashlib
import os
import re
import sys
import tempfile
import zipfile


def zip_directory(src_dir, zip_path):
  all_file_paths = []
  for root, _, files in os.walk(src_dir):
    for file in files:
      file_path = os.path.join(root, file)
      rel_path = os.path.relpath(file_path, 'third_party/firebase/agent_skills')

      # Exclude developing_genkit_ skills
      if rel_path.startswith('skills/developing_genkit_'):
        continue

      # Exclude BUILD and eval.yaml files
      if file == 'BUILD' or file.lower() == 'eval.yaml':
        continue

      all_file_paths.append(file_path)

  # Also include plugin.json from the root of agent_skills
  plugin_json = 'third_party/firebase/agent_skills/plugin.json'
  if os.path.exists(plugin_json):
    all_file_paths.append(plugin_json)

  with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for file_path in sorted(all_file_paths):
      arcname = os.path.relpath(file_path, 'third_party/firebase/agent_skills')
      # Use a fixed timestamp for determinism
      zinfo = zipfile.ZipInfo(arcname, (2026, 1, 1, 0, 0, 0))
      zinfo.compress_type = zipfile.ZIP_DEFLATED
      with open(file_path, 'rb') as f:
        zipf.writestr(zinfo, f.read())


def calculate_sha256(file_path):
  sha256_hash = hashlib.sha256()
  with open(file_path, 'rb') as f:
    for byte_block in iter(lambda: f.read(4096), b''):
      sha256_hash.update(byte_block)
  return sha256_hash.hexdigest()


def update_config(config_path, sha256):
  with open(config_path, 'r') as f:
    content = f.read()

  pattern = r"""    jetski_pb\.BuildWithGooglePlugin\(
        plugin=jetski_pb\.AgentPlugin\(
            name='firebase',
            .*?
        \),
        gstatic=jetski_pb\.GStaticSource\(
            link='[^']*',
            sha256='([^']*)',
        \),
    \),"""

  match = re.search(pattern, content, flags=re.DOTALL)

  if match:
    matched_block = match.group(0)
    new_matched_block = re.sub(
        r"sha256='[^']*'", f"sha256='{sha256}'", matched_block
    )
    new_content = content.replace(matched_block, new_matched_block)
    with open(config_path, 'w') as f:
      f.write(new_content)
    print(f'Updated {config_path} with new SHA-256.')
  else:
    print(f'Error: Could not find firebase plugin entry in {config_path}')


def main():
  if 'BUILD_WORKSPACE_DIRECTORY' in os.environ:
    os.chdir(os.environ['BUILD_WORKSPACE_DIRECTORY'])

  # Ensure we are in google3 root
  if not os.path.exists('third_party/firebase/agent_skills'):
    print('Error: Please run this script from the google3 root directory.')
    sys.exit(1)

  parser = argparse.ArgumentParser(
      description='Update or check Firebase Jetski plugin.'
  )
  parser.add_argument(
      '--check', action='store_true', help='Check consistency without updating.'
  )
  args = parser.parse_args()

  src_dir = 'third_party/firebase/agent_skills/skills'
  gstatic_dir = (
      'googledata/html/external_content/gstatic/antigravity/buildWithGoogle'
  )
  config_path = 'cloud/developer_experience/cloudcode/pa/jetski_service/config/build_with_google_plugins.pi'

  if args.check:
    print('Checking consistency...')
    with tempfile.NamedTemporaryFile(suffix='.zip') as tmp:
      zip_directory(src_dir, tmp.name)
      sha256 = calculate_sha256(tmp.name)

      with open(config_path, 'r') as f:
        content = f.read()

      find_pattern = r"""    jetski_pb\.BuildWithGooglePlugin\(
        plugin=jetski_pb\.AgentPlugin\(
            name='firebase',
            .*?
        \),
        gstatic=jetski_pb\.GStaticSource\(
            link='[^']*',
            sha256='([^']*)',
        \),
    \),"""

      match = re.search(find_pattern, content, flags=re.DOTALL)
      if not match:
        print(f'Error: Could not find firebase plugin entry in {config_path}')
        sys.exit(1)

      current_sha = match.group(1)
      if current_sha != sha256:
        print('Error: Consistency check failed!')
        print(f'Expected (from config): {current_sha}')
        print(f'Calculated:              {sha256}')
        print(
            'Please run: blaze run'
            ' //third_party/firebase/agent_skills:update_jetski_plugin'
        )
        sys.exit(1)

      print('Consistency check passed.')
  else:
    zip_path = os.path.join(gstatic_dir, 'firebase.zip')
    print(f'Zipping skills to {zip_path}...')
    os.makedirs(gstatic_dir, exist_ok=True)
    zip_directory(src_dir, zip_path)

    sha256 = calculate_sha256(zip_path)
    print(f'SHA-256: {sha256}')

    update_config(config_path, sha256)

    print('Done!')


if __name__ == '__main__':
  main()
