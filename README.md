# commit-agent-cli

AI-powered git commit CLI that analyzes your changes and generates conventional commit messages using Claude 4.5.

## Features

-   **🤖 AI-Powered**: Uses Claude 4.5 (via Anthropic) with LangGraph for intelligent commit message generation.
-   **🕵️ Agentic Exploration**: The AI agent can autonomously explore your codebase and git history:
    -   Read files to understand context
    -   List directories to understand project structure
    -   Check commit history to learn your project's conventions
    -   View staged, unstaged, and untracked files
    -   Examine detailed diffs for specific files
-   **👁️ Transparent**: See exactly what the agent is doing with detailed console logs showing every file read, directory listed, and git command executed.
-   **⚙️ Customizable**: First-time setup asks for your preferences:
    -   Use conventional commit prefixes (feat:, fix:, chore:, etc.) or natural language
    -   Choose between concise or descriptive commit messages
-   **✨ Interactive**: Beautiful CLI interface built with `@clack/prompts`.
-   **🔒 Secure**: API keys and preferences are stored locally in `~/.commit-cli.json`.

## Installation

```bash
npm install -g commit-agent-cli
```

## Usage

1.  Stage your changes:
    ```bash
    git add .
    ```

2.  Run the tool:
    ```bash
    commit
    ```

3.  **First Time Setup**:
    -   You'll be prompted to enter your Anthropic API Key (`sk-...`)
    -   Choose whether to use conventional commit prefixes
    -   Select your preferred commit message style (concise vs descriptive)
    -   These preferences are saved and can be changed by editing `~/.commit-cli.json`

4.  **Watch the Agent Work**:
    The CLI will show you exactly what the agent is doing:
    ```
    📜 Agent is checking last 10 commits
    📋 Agent is listing staged files
    🔍 Agent is reading: src/index.ts
    📂 Agent is listing directory: src
    ```

5.  **Review and Commit**:
    -   Review the generated commit message
    -   Choose to commit, regenerate, or cancel
    -   Optionally push changes immediately

## Agent Capabilities

The AI agent has access to these tools to understand your codebase:

-   **read_file**: Read any file to understand code context
-   **list_dir**: Explore directory structure
-   **git_commit_history**: Learn from your previous commits
-   **git_staged_files**: See what's being committed
-   **git_unstaged_files**: View unstaged changes
-   **git_untracked_files**: List untracked files
-   **git_show_file_diff**: Examine detailed diffs

The agent will intelligently use these tools to generate contextually appropriate commit messages.

## Configuration

Your configuration is stored in `~/.commit-cli.json`:

```json
{
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "preferences": {
    "useConventionalCommits": true,
    "commitMessageStyle": "concise"
  }
}
```

You can manually edit this file to change your preferences.

## Development

```bash
git clone https://github.com/sunggyeol/commit-agent-cli.git
cd commit-agent-cli
npm install
npm run build
npm start
```

## License

MIT
