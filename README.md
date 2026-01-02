# commit-agent-cli

> AI-powered git commit message generator using Claude Sonnet 4.5 and LangGraph

Generate intelligent, context-aware commit messages by simply typing `commit`.

## Quick Start

```bash
# Install globally
npm install -g commit-agent-cli

# Stage your changes
git add .

# Generate commit message
commit
```

## First-Time Setup

You'll be prompted to:
1. Enter your [Anthropic API Key](https://console.anthropic.com)
2. Choose commit message preferences (conventional commits, verbosity)

## Features

Powered by Claude Sonnet 4.5, this tool autonomously explores your codebase to generate intelligent commit messages with full transparency into its reasoning process. Supports customizable commit styles with secure local configuration storage.

## Documentation

📚 **[View Full Documentation](./docs/README.md)** - Detailed guides, configuration, and examples

## Requirements

- Node.js 18+
- Anthropic API key

## License

MIT

---

**Links:** [GitHub](https://github.com/sunggyeol/commit-agent-cli) • [Issues](https://github.com/sunggyeol/commit-agent-cli/issues) • [Docs](./docs/README.md)
