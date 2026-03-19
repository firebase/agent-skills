# Firebase Agent Skills: `fbs-to-agy-export`

This skill helps your AI assistant easily convert **Firebase Studio** projects into **Antigravity** projects.

It includes both the agent skill and a complementary workflow, which are designed to work out-of-the-box in the Antigravity agent environment.

## Installation

### Option 1: Agent Skills CLI 

For most popular AI-assistive tools, you can use the `skills` CLI to install Firebase agent skills:

```bash
npx skills add https://github.com/firebase/agent-skills/tree/fbs-to-agy-export
```

### Option 2: Manual Set Up

1. Clone this repository:

```bash
git clone -b fbs-to-agy-export --single-branch https://github.com/firebase/agent-skills.git
```

2. Copy the downloaded `skills` and `workflows` directories to your preferred Antigravity configuration folder:
   - **For a specific project:** Place them in the `.antigravity/` folder at the root of your project.
   - **For all projects globally:** Place them in the `~/.antigravity/` folder in your user home directory.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push your branch to your fork: `git push origin feature/amazing-feature`
5. Open a Pull Request (PR) targeting the `fbs-to-agy-export` branch

## 📄 License

This project is licensed under the Apache 2 License - see the [LICENSE](LICENSE) file for details.

**Made with ❤️ from Firebase for the AI community**
