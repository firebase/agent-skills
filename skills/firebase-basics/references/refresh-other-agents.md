# Refresh Other Local Environment

Follow these steps to refresh the local environment of other agents, ensuring that their agent skills and plugins are fully up-to-date.

Other agents rely on `npx skills`. Updates should prioritize the global level; if skills are installed at the project level, omit the `--global` flag.

Replace `<AGENT_NAME>` with the actual agent name, which can be found [here](https://github.com/vercel-labs/skills/blob/main/README.md).

1. **Check for New Skills:** The `update` command only updates existing skills. To see if new skills have been added to the repository, run:
   ```bash
   npx -y skills add firebase/agent-skills --list
   ```
2. **Check if Skills are Already Installed:** The `update` command only updates existing skills. To see if new skills have been added to the repository, run:
   ```bash
   npx -y skills list --agent <AGENT_NAME>
   npx -y skills list --agent <AGENT_NAME> --global
   ```
3. **Update Installed Skills:** Run the following to update all currently installed skills to their latest versions:
   ```bash
   # Refresh project-level skills
   npx -y skills update --agent <AGENT_NAME> --yes
   # Refresh global-level skills
   npx -y skills update --agent <AGENT_NAME> --global --yes
   ```
4. **Add New Skills (If Any):** If step 1 and 2 revealed new skills, install them:
   ```bash
   # Add project-level skills
   npx -y skills add firebase/agent-skills --agent <AGENT_NAME> --skill "<NEW_SKILL_NAME>" --yes
   # Add global-level skills
   npx -y skills add firebase/agent-skills --agent <AGENT_NAME> --skill "<NEW_SKILL_NAME>" --global --yes
   ```
