# Claude Code Tools for Crypto Research

A curated, weekly-updated collection of Claude Code plugins, skills, and MCP connectors built for crypto use cases.

The goal is simple: **position your brand in the highest-signal conversations in web3 and grow your audience** — by giving Claude direct access to X/Twitter data, real-time web research, and an ever-expanding library of research skills.

---

## Add This Marketplace

```bash
/plugin marketplace add incyd/claude-crypto-research-tools
```

---

## What's Inside

### 🔌 MCP Connectors

Three options for connecting Claude to live data. Pick the one that fits your workflow:

| Connector | Best for | Cost | Filtering |
|-----------|----------|------|-----------|
| [Native X AI MCP](./connectors/x-research-mcp/) | Trending narratives, topic discovery | 💸 Expensive | Excellent |
| [Netrows X MCP](./connectors/netrows-x-mcp/) | Pulling KOL tweets, account research | ✅ Free tier + good value | Limited |
| [Tavily MCP](./connectors/tavily-mcp/) | Web context, TVL data, DeFi research | ✅ Generous free tier | N/A |

**When to use which:**

- **Native X AI MCP** — best-in-class topic search and filter criteria (likes, impressions, date ranges). Ideal for trending narrative research and broad signal discovery. Use it when quality of results matters most and cost isn't a constraint.
- **Netrows X MCP** — great free tier and solid overall value. Filtering is more limited but it excels at pulling tweets from individual accounts and KOLs. The go-to for account-level research without needing an X developer account.
- **Tavily** — purpose-built for AI agents, not rate-limited like search engines. Best for pulling web context: protocol docs, TVL data from DeFiLlama, news articles, on-chain analytics. Use alongside an X connector for full coverage.

---

### 🛠️ Plugins

| Plugin | What it does |
|--------|-------------|
| [Setup Skills Master MCP](./plugins/setup-skills-master-mcp/) | Installs and configures the skills-master MCP server so Claude can discover and install skills from within any conversation. Run `/setup-skills-master-mcp` to start. |

---

### 📦 Skills — 17 vetted

Community skills curated for crypto research workflows. All passed skillvet's 48-check security scan. → [Full catalog](./skills/) · [Install commands](./skills/INSTALL.md)

| Category | Skills | Count |
|----------|--------|-------|
| [🔒 Security](./skills/README.md#security-run-this-first) | skillvet | 1 |
| [🌐 Domain](./skills/README.md#domain-crypto-web3-xtwitter) | x-research, x-mastery, twitter-algorithm-optimizer, web3-research, competitive-analysis, brand-voice-extractor | 6 |
| [📄 Document Creation](./skills/README.md#document-creation) | prd, senior-architect, prompt-engineering, design-serialization-schema | 4 |
| [🤖 Orchestration](./skills/README.md#orchestration) | multi-agent-coordination, multi-agent-analysis, swarm-orchestration, agent-memory-systems | 4 |
| [✅ Quality](./skills/README.md#quality) | humanizer, validator-role-skill | 2 |

---

## Quick Setup

### Native X AI MCP — Claude.ai

1. Go to [Claude.ai → Settings → Connectors → Add custom connector](https://claude.ai/settings)
2. Paste the URL:
   ```
   https://x-research-mcp.onrender.com/mcp
   ```
3. Ask Claude to call `setup_session` with your X API bearer token — you'll receive a permanent session URL tied to your token.
4. Replace the URL with your session URL. Done.

→ [Full setup guide](./connectors/x-research-mcp/)

---

### Netrows X MCP — Claude Code or Claude.ai

1. Get a Netrows API key at [netrows.com](https://www.netrows.com)
2. Add to `.mcp.json` in your project:
   ```json
   {
     "mcpServers": {
       "netrows-x": {
         "url": "https://netrows-x-mcp.onrender.com/mcp?netrows_api_key=pk_live_YOUR_KEY"
       }
     }
   }
   ```
   Or add the same URL directly in Claude.ai → Settings → Connectors.
3. Restart Claude Code.

→ [Full setup guide](./connectors/netrows-x-mcp/)

---

### Tavily MCP — Claude Code

1. Get a free API key at [app.tavily.com](https://app.tavily.com)
2. Add to `.mcp.json`:
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
3. Restart Claude Code.

> **nvm users:** Claude Code doesn't inherit your shell's PATH. If `node` isn't found, run `/setup-skills-master-mcp` for a guided fix.

→ [Full setup guide](./connectors/tavily-mcp/)

---

### Setup Skills Master MCP — Claude Code

Gives Claude the ability to search, preview, and install skills from within any conversation — no terminal needed.

**Fastest install:**
```bash
curl -fsSL https://raw.githubusercontent.com/incyd/skills-master-mcp-setup-skill/main/install.sh | bash
```

**Via marketplace (if already installed):**
```
/setup-skills-master-mcp
```

**Via plugin system:**
```bash
/plugin install setup-skills-master-mcp@claude-crypto-research-tools
```

→ [Plugin docs](./plugins/setup-skills-master-mcp/)

---

## Repo Structure

```
connectors/
  x-research-mcp/          ← Native X AI MCP (bearer token, 5 tools)
  netrows-x-mcp/           ← Netrows X MCP (API key, 14 tools)
  tavily-mcp/              ← Tavily web search MCP
plugins/
  setup-skills-master-mcp/ ← Claude Code skill + MCP installer
skills/
  skills-registry.json     ← Machine-readable source of truth (17 skills)
  README.md                ← Catalog grouped by category
  INSTALL.md               ← One-liner install commands
```

---

Updated weekly · Maintained by [incyd](https://github.com/incyd)
