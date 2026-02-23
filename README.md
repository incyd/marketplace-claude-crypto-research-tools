# 🔬 Crypto Research Tools for Claude

A marketplace of Claude integrations for crypto research — an X/Twitter MCP connector for Claude.ai and a Claude Code skill for developer tooling.

---

## 🚀 Add This Marketplace

```bash
/plugin marketplace add incyd/marketplace-claude-crypto-research-tools
```

---

## 📦 What's Inside

| Component | Type | Description |
|-----------|------|-------------|
| [X Research MCP Connector](./connectors/x-research-mcp/) | Claude.ai MCP Server | Search X/Twitter, fetch profiles, threads, and tweets from Claude.ai |
| [Setup Skills Master MCP](./plugins/setup-skills-master-mcp/) | Claude Code Skill | Configure the skills-master MCP server for Claude Code |

---

## ⚡ Setup

### X Research MCP Connector — Claude.ai

Add the MCP server URL in **Claude.ai → Settings → Integrations → MCP Servers**:

```
https://x-research-mcp.onrender.com/mcp
```

Then ask Claude to call `setup_session` with your X API bearer token to save it.

→ [Full setup guide](./connectors/x-research-mcp/)

---

### Setup Skills Master MCP — Claude Code

```bash
/plugin install setup-skills-master-mcp@claude-crypto-research-tools
```

Then ask Claude: *"set up skills-master-mcp for this project"*

→ [Plugin docs](./plugins/setup-skills-master-mcp/)

---

## 🗂️ Structure

```
connectors/
  x-research-mcp/     ← X Research MCP server (Claude.ai integration)
plugins/
  setup-skills-master-mcp/  ← Claude Code skill
mcp-server/           ← Source code for the X Research MCP server
```

---

## 🔧 Maintained by [incyd](https://github.com/incyd)
