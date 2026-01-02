# commit-agent-cli

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

Powered by Claude and Gemini, this tool intelligently explores your codebase to generate clear, context-aware commit messages with full transparency. Enjoy customizable commit styles, secure local configuration, and seamless switching between AI providers.

## Documentation

📚 **[View Full Documentation](./docs/README.md)** - Detailed guides, configuration, and examples

## Requirements

- Node.js 18+
- Anthropic API key OR Google AI API key

## License

MIT

---

**Links:** [GitHub](https://github.com/sunggyeol/commit-agent-cli) 
