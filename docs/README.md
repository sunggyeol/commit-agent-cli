# commit-agent-cli Documentation

Complete guide to using the AI-powered git commit message generator.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Agent Capabilities](#agent-capabilities)
- [Configuration](#configuration)
- [Advanced Usage](#advanced-usage)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Installation

### Global Installation (Recommended)

```bash
npm install -g commit-agent-cli
```

### Local Installation

```bash
npm install --save-dev commit-agent-cli
```

Then add to your `package.json`:
```json
{
  "scripts": {
    "commit": "commit"
  }
}
```

## Getting Started

### 1. Get Your API Key

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key

### 2. First Run

```bash
git add .
commit
```

You'll be prompted to:
- Enter your Anthropic API Key
- Choose whether to use conventional commit prefixes (feat:, fix:, etc.)
- Select commit message style (concise vs descriptive)

Your preferences are saved in `~/.commit-cli.json`

### 3. Normal Usage

After setup, just run:
```bash
commit
```

The agent will:
1. Analyze your staged changes
2. Explore your codebase if needed (you'll see what it's doing)
3. Generate a commit message
4. Let you review, regenerate, or edit
5. Commit and optionally push

## How It Works

### Token Optimization

The CLI is designed to minimize token usage and API costs:

**Smart Diff Processing:**
- Uses `--unified=1` for compact diffs (1 line of context instead of 3)
- Includes file list and stats summary
- For very large changesets (>2000 tokens), automatically switches to `--unified=0` (no context lines)
- Removes unnecessary color codes and prefixes

**Aggressive Tool Usage Prevention:**
- Optimized diff contains 95%+ of needed information
- Agent is instructed to avoid tool calls unless critical
- File reading limited to 50KB and 10K characters
- Commit history capped at 5 commits

**Example Token Savings:**
- Traditional full diff: ~3000-5000 tokens
- Optimized compact diff: ~800-1500 tokens
- **Savings: 60-70% reduction**

### The Agent Loop

The CLI uses LangGraph to create an agentic workflow:

```
1. Analyze optimized git diff (includes files, stats, changes)
2. Generate commit message directly (95% of cases)
3. Use tools ONLY if absolutely necessary:
   - Read specific files (rare)
   - Check commit history (very rare)
4. Present commit message to user
```

### What You'll See

The agent shows you exactly what it's doing:
```
🔍 Agent is reading: src/index.ts
📂 Agent is listing directory: src
📜 Agent is checking last 5 commits
📋 Agent is listing staged files
```

## Agent Capabilities

### Available Tools

The agent can use these tools to understand your changes:

| Tool | Description | When Used |
|------|-------------|-----------|
| `read_file` | Read file contents (max 50KB) | When diff references unclear code |
| `list_dir` | List directory contents | To understand project structure |
| `git_commit_history` | Check last 5 commits | To learn project conventions |
| `git_staged_files` | See all staged files | To understand scope of changes |
| `git_unstaged_files` | View unstaged changes | Rarely used |
| `git_untracked_files` | List untracked files | Rarely used |
| `git_show_file_diff` | View detailed file diff | For specific file analysis |

### Efficiency

The agent is designed to be efficient:
- ✅ Analyzes the diff first (90% of cases, no tools needed)
- ✅ Max 2 files read per commit
- ✅ Max 5 commits checked in history
- ✅ 50KB file size limit
- ✅ 10,000 character truncation

## Configuration

### Config File Location

`~/.commit-cli.json`

### Config Structure

```json
{
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "preferences": {
    "useConventionalCommits": true,
    "commitMessageStyle": "concise"
  }
}
```

### Preference Options

**`useConventionalCommits`** (boolean)
- `true`: Use prefixes like `feat:`, `fix:`, `chore:`
- `false`: Natural language commit messages

**`commitMessageStyle`** (string)
- `"concise"`: Short, one-line messages
- `"descriptive"`: Detailed, multi-line messages with explanations

### Changing Preferences

Edit `~/.commit-cli.json` manually, or delete it to run the setup again.

## Advanced Usage

### Environment Variables

You can set the API key via environment variable instead of the config file:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
commit
```

### Using in CI/CD

For automated environments:

```bash
# Set API key
export ANTHROPIC_API_KEY=$YOUR_SECRET_KEY

# Stage changes
git add .

# Generate and commit (you'll need to handle the interactive prompts)
commit
```

**Note:** The CLI is interactive by default. For CI/CD, you might want to use traditional git commands.

### Custom Workflows

You can integrate with other tools:

```bash
# Pre-commit hook
git add .
commit

# With git aliases
git config --global alias.ai-commit '!git add . && commit'
```

## Development

### Setup

```bash
git clone https://github.com/sunggyeol/commit-agent-cli.git
cd commit-agent-cli
npm install
```

### Build

```bash
npm run build
```

### Test Locally

```bash
npm start
# or
npm link
commit
```

### Project Structure

```
commit-agent-cli/
├── src/
│   ├── index.ts      # Main CLI entry point
│   ├── agent.ts      # LangGraph agent logic
│   ├── git.ts        # Git operations
│   └── tools.ts      # Agent tools (file reading, git commands)
├── dist/             # Built files
├── package.json
└── README.md
```

## Troubleshooting

### "ANTHROPIC_API_KEY is not set"

**Solution:** Run `commit` again and enter your API key when prompted.

### "No staged changes found"

**Solution:** Stage your changes first:
```bash
git add .
commit
```

### "File too large" error

**Solution:** The agent can only read files under 50KB. This is intentional for efficiency.

### Agent is too slow

**Possible causes:**
- Large diff (many files changed)
- Agent reading multiple files

**Solution:** The agent is optimized to be efficient. If it's consistently slow, check your network connection to Anthropic's API.

### Commit message is not what I expected

**Solutions:**
1. Click "Regenerate" to try again
2. Edit the message manually before committing
3. Adjust your preferences in `~/.commit-cli.json`

### API Key issues

**Invalid key:**
- Verify your key at https://console.anthropic.com
- Make sure it starts with `sk-ant-`
- Delete `~/.commit-cli.json` and re-enter

**Rate limits:**
- You've hit Anthropic's API rate limits
- Wait a few minutes and try again
- Check your usage at https://console.anthropic.com

### Update notifications not showing

**Why it might not show:**

The update notifier only works when:
1. ✅ The package is published to npm
2. ✅ A newer version exists on npm registry
3. ✅ You're using an older version
4. ✅ At least 1 hour has passed since last check (cached)

**To test update notifications:**

1. First, publish current version to npm:
   ```bash
   npm publish
   ```

2. Then bump version and publish again:
   ```bash
   npm version patch
   npm publish
   ```

3. Users with the old version will see:
   ```
   ╭───────────────────────────────────────────────────────────────────╮
   │                                                                   │
   │  New version of commit-cli is available!                         │
   │                                                                   │
   │  Current version:  0.1.3                                         │
   │  Latest version:   0.1.6                                         │
   │                                                                   │
   │  You can update it by running:                                   │
   │  npm install -g commit-agent-cli                                 │
   │                                                                   │
   │  If you get an error, try:                                       │
   │  npm uninstall -g commit-agent-cli && npm install -g commit-agent-cli │
   │                                                                   │
   ╰───────────────────────────────────────────────────────────────────╯
   ```

**Clear notification cache (for testing):**
```bash
rm -rf ~/.config/configstore/update-notifier-commit-agent-cli.json
```

### npm install/update errors

**ENOTEMPTY error when updating:**

```
npm error ENOTEMPTY: directory not empty
```

**Why this happens:**
- You tried to update while the CLI was running
- npm cannot update a package that's currently in use
- This is a node/npm limitation, not a bug

**Solution - Wait until CLI finishes, then update:**
```bash
# After the CLI completes and exits, run:
npm install -g commit-agent-cli@latest --force
```

**If the error persists (package is locked):**

Option 1 - Manual cleanup for nvm users:
```bash
# Find your Node version: node -v
# Replace v22.16.0 with your version
rm -rf ~/.nvm/versions/node/v22.16.0/lib/node_modules/commit-agent-cli
npm install -g commit-agent-cli
```

Option 2 - Clean npm cache:
```bash
npm cache clean --force
npm install -g commit-agent-cli@latest --force
```

Option 3 - Find and remove manually:
```bash
# Find where npm packages are installed
npm root -g

# Remove the directory (example paths):
# nvm: rm -rf ~/.nvm/versions/node/$(node -v)/lib/node_modules/commit-agent-cli
# Linux: sudo rm -rf /usr/local/lib/node_modules/commit-agent-cli
# Mac: sudo rm -rf /usr/local/lib/node_modules/commit-agent-cli

# Then reinstall
npm install -g commit-agent-cli
```

**Permission errors on Linux/Mac:**

```
npm error EACCES: permission denied
```

**Solutions:**

Option 1 - Use nvm (recommended):
```bash
# Install nvm if you haven't
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g commit-agent-cli
```

Option 2 - Fix npm permissions:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
source ~/.profile
npm install -g commit-agent-cli
```

Option 3 - Use sudo (not recommended):
```bash
sudo npm install -g commit-agent-cli
```

## Support

- **Issues:** [GitHub Issues](https://github.com/sunggyeol/commit-agent-cli/issues)
- **Discussions:** [GitHub Discussions](https://github.com/sunggyeol/commit-agent-cli/discussions)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT © 2024
