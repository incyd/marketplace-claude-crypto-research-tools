# Tavily MCP Connector

Give Claude real-time web search powered by [Tavily](https://tavily.com) — an AI-optimised search API built for agents. Useful for research workflows, fact-checking, news monitoring, and enriching analysis with up-to-date information.

---

## What you can do

Once connected, ask Claude naturally:

```
Search the web for the latest news on the SEC crypto crackdown
```
```
Find recent analyst takes on Ethereum\'s roadmap
```
```
What happened with the Bybit hack? Pull current sources
```
```
Research this company and summarise what you find: [URL or name]
```

---

## Setup (~2 minutes)

### Step 1 — Get a Tavily API key

1. Go to [app.tavily.com](https://app.tavily.com) and sign up (free tier available)
2. Copy your API key — it starts with `tvly-...`

---

### Step 2 — Add to Claude Code

Add to `.mcp.json` in your project root (or `~/.claude.json` for global access):

```json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "tavily-mcp"],
      "env": {
        "TAVILY_API_KEY": "tvly-YOUR_KEY_HERE"
      }
    }
  }
}
```

If you use nvm, replace `npx` with the full path to your node bin:

```json
{
  "mcpServers": {
    "tavily": {
      "command": "/Users/yourname/.nvm/versions/node/v20.0.0/bin/npx",
      "args": ["-y", "tavily-mcp"],
      "env": {
        "TAVILY_API_KEY": "tvly-YOUR_KEY_HERE",
        "PATH": "/Users/yourname/.nvm/versions/node/v20.0.0/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

> **nvm users:** Claude Code does not inherit your shell\'s nvm PATH. See the [setup-skills-master-mcp](../../plugins/setup-skills-master-mcp/README.md) plugin for a guided fix.

Restart Claude Code after editing `.mcp.json`. The `tavily-mcp` tools will be available immediately.

---

### Step 3 — Add to Claude.ai (optional)

Tavily does not expose a hosted MCP URL — it runs as a local process. For Claude.ai, use the Tavily web connector if available in your plan, or use Claude Code instead.

---

## Available Tools

The `tavily-mcp` package exposes:

| Tool | What it does |
|------|-------------|
| `tavily-search` | Real-time web search with AI-ranked results |
| `tavily-extract` | Extract structured content from a URL |

---

## Free tier limits

Tavily\'s free tier includes 1,000 API credits/month. Each search costs 1 credit. Paid plans start at $35/month for higher volume.
