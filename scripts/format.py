#!/usr/bin/env python3
import os
import subprocess
import sys

def main():
    # Determine the directory paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    
    # Separate options (starting with '-') from positional arguments (files)
    options = []
    input_paths = []
    for arg in sys.argv[1:]:
        if arg.startswith('-'):
            options.append(arg)
        else:
            input_paths.append(arg)
            
    if input_paths:
        # User specified files/directories explicitly
        md_files = []
        for path in input_paths:
            abs_path = os.path.abspath(path)
            if os.path.isdir(abs_path):
                # Walk the directory
                exclude_dirs = {
                    '.git', 'node_modules', '.venv', '.agents',
                    '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.jetskicli'
                }
                for root, dirs, files in os.walk(abs_path):
                    dirs[:] = [d for d in dirs if d not in exclude_dirs]
                    for file in files:
                        if file.endswith('.md'):
                            md_files.append(os.path.join(root, file))
            elif os.path.isfile(abs_path) and abs_path.endswith('.md'):
                md_files.append(abs_path)
    else:
        # Walk the entire repository
        exclude_dirs = {
            '.git',
            'node_modules',
            '.venv',
            '.agents',
            '.claude-plugin',
            '.codex-plugin',
            '.cursor-plugin',
            '.jetskicli',
        }
        md_files = []
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file.endswith('.md'):
                    md_files.append(os.path.join(root, file))
                    
    if not md_files:
        print("No markdown files found to format.")
        return
        
    # Run mdformat
    cmd = [sys.executable, '-m', 'mdformat', '--wrap', '80'] + options + md_files
    
    # Run the command and propagate exit code
    result = subprocess.run(cmd)
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
