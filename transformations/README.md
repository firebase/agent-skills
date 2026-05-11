# Skills Transformations

This directory contains transformed versions of the skills repository, tailored for specific platforms or use cases.

## Intended Structure

Each transformation should live in its own subdirectory under `transformations/`.

```text
transformations/
├── README.md                  # This file
└── [transformation-name]/
    ├── generator/             # Scripts and guides for generation
    │   ├── generate_android_skills.js
    │   └── generate-android-studio-bundle.md
    └── skills/                # The generated content
        ├── firebase-basics
        └── ...
```

### Components

- **`generator/`**: Contains the scripts used to perform the transformation and any guides or prompts used to polish the output.
- **`skills/`**: Contains the actual generated skills.

## How to Install a Transformation

To install a specific transformation using the `skills` CLI, use the GitHub URL pointing to the generated skills directory:

```bash
npx skills add https://github.com/firebase/agent-skills/tree/main/transformations/[transformation-name]/skills
```

For example, to install the Android Studio bundle:

```bash
npx skills add https://github.com/firebase/agent-skills/tree/main/transformations/android-studio/skills
```

To add a new transformation, follow these steps:

1. **Create a new directory** under `transformations/` named after your platform or use case (e.g., `transformations/vscode`).
2. **Create a `generator/` directory** inside your new directory.
3. **Add your transformation script** to the `generator/` directory. This script should read from the root `skills/` directory and write to `transformations/[transformation-name]/skills/`.
4. **Add a guide or prompt** (e.g., `README.md` or `guide.md`) in the `generator/` directory explaining how to run the transformation and any manual cleanup required.
5. **Update the root documentation** if necessary to point to the new transformation.

### Best Practices

- **Automate as much as possible**: Use scripts to filter files and clean up links.
- **Use LLMs for semantic cleanup**: If regex is insufficient to fix grammar after link removal, provide a prompt for an LLM to do the final polish.
- **Keep source of truth in root `skills/`**: All transformations should be derivable from the core content in the root `skills/` directory.
