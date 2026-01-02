# commit-agent-cli

> AI-powered git commit message generator using Claude Sonnet 4.5 / Opus 4.5 or Google Gemini and LangGraph

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
1. Select your AI Provider (Anthropic Claude or Google Gemini)
2. Choose your preferred model
3. Enter your API Key ([Anthropic Console](https://console.anthropic.com) or [Google AI Studio](https://aistudio.google.com/app/apikey))
4. Choose commit message preferences (conventional commits, verbosity)

## Features

Powered by Claude Sonnet 4.5 / Opus 4.5 or Google Gemini, this tool autonomously explores your codebase to generate intelligent commit messages with full transparency into its reasoning process. Supports customizable commit styles with secure local configuration storage and the ability to switch between AI providers at any time.

## Documentation

📚 **[View Full Documentation](./docs/README.md)** - Detailed guides, configuration, and examples

## Requirements

- Node.js 18+
- Anthropic API key OR Google AI API key

## License

MIT

---

**Links:** [GitHub](https://github.com/sunggyeol/commit-agent-cli) • [Issues](https://github.com/sunggyeol/commit-agent-cli/issues) • [Docs](./docs/README.md)
