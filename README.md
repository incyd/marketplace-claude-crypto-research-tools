# 🔬 Crypto Research Tools for Claude

A curated marketplace of Claude Code plugins and MCP connectors for crypto research — search X/Twitter, track narratives, and surface alpha directly from Claude.

---

## 🚀 Add This Marketplace

```bash
/plugin marketplace add incyd/marketplace-claude-crypto-research-tools
```

---

## 📦 What's Inside

| Component | Type | Description |
|-----------|------|-------------|
| [X Research MCP Connector](./connectors/x-research-mcp/) | MCP Server | Query X/Twitter data from Claude.ai — search tweets, profiles, threads |
| [X Research Skill](./plugins/x-research/) | Claude Code Plugin | Claude Code skill for X research workflows |

---

## ⚡ Quick Install

### MCP Connector (Claude.ai)

Connect directly from Claude.ai — no account, no Apify, no friction:

```
https://x-research-mcp.onrender.com/mcp
```

→ See [full setup guide](./connectors/x-research-mcp/)

### Claude Code Plugin

```bash
/plugin install x-research@claude-crypto-research-tools
```

→ See [plugin docs](./plugins/x-research/)

---

## 🗂️ Categories

### 📡 Social Intelligence
Real-time X/Twitter data — search by keyword, filter by engagement, fetch threads and profiles.

| Tool | What It Does |
|------|-------------|
| `search_x` | Search recent tweets with X operators, filter by likes/impressions |
| `get_profile` | Fetch recent tweets from any account |
| `get_thread` | Pull a full conversation thread |
| `get_tweet` | Look up a single tweet by ID |

---

## 🔧 Maintained by

[incyd](https://github.com/incyd)
