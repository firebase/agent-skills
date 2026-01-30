# Firebase Agent Skills

A collection of skills for AI coding agents, to help them understand and work with Firebase more effectively. 

Skills are packaged instructions and scripts that extend agent capabilities, following the [Agent Skills](https://agentskills.io/home) format.

## Installation

### Option 1: Agent Skills CLI 

For most popular AI-assistive tools, you can use the `skills` CLI to install Firebase agent skills:

```bash
npx skills add firebase/skills
```

### Option 2: Gemini CLI Extension

This repository is configured as a Gemini CLI extension. You can add it using the Gemini CLI:

```bash
gemini extensions install https://github.com/firebase/skills
```

### Option 3: Claude Plugin

1. Add the Firebase marketplace for Claude plugins:

```bash
claude plugin marketplace add firebase/firebase-tools
```

Install the Claude plugin for Firebase:

```bash
claude plugin install firebase@firebase
```

Verify the installation:

```bash
claude plugin marketplace list
```

### Option 4: Manual Set Up

1. Clone this repository:

```bash
git clone https://github.com/firebase/skills.git
```

2. Copy the contents of the `skills` directory to the appropriate location for your AI tool.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request (PR)

## 📄 License

This project is licensed under the Apache 2 License - see the [LICENSE](LICENSE) file for details.

**Made with ❤️ from Firebase for the AI community**
