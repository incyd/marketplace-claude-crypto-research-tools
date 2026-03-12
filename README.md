# Claude Code Tools for Crypto Research

A curated, weekly-updated collection of Claude Code plugins, skills, and MCP connectors built for crypto use cases.

The goal is simple: **position your brand in the highest-signal conversations in web3 and grow your audience** — by giving Claude direct access to X/Twitter data, real-time web research, and an ever-expanding library of research skills.

---

## Add This Marketplace

```bash
/plugin marketplace add incyd/claude-crypto-research-tools
```

---

## Featured Plugin

### [V3 Daily KOL](./plugins/v3-daily-kol/) — `v3.1` now available

Most crypto content tools treat every day as day one. V3 Daily KOL builds a **personalized context database** that grows with every run — accumulating signal history, narrative trajectories, and account-specific knowledge across sessions. The longer it runs, the better it understands what's actually moving in your niche.

That context is what drives discovery. Instead of generic trending topics, you get narratives ranked by signal strength, validated across sources, and tracked through their lifecycle from emerging to established to fading.

Every day it outputs:

- **20+ engagement replies** in your voice, ready to post
- **2–3 own-post recommendations** with supporting data and draft copy
- **Narrative intelligence** — what's gaining momentum, what's peaking, what's fading in your space

Four agents, append-only data, persistent memory across every session.

| Agent | Model | When | What it does |
|-------|-------|------|-------------|
| ① Onboarding | Opus 4.6 | Once | Builds your account profile from 200 posts — topics, keywords, voice, KOL list |
| ② Daily Pull | Sonnet 4.6 | Daily | Pulls topic signals (Kaito + X API), TL timelines, your own posts — adds to context DB |
| ③ Analytics | Opus 4.6 | Daily | Scores signals, detects narrative convergence, generates replies + post recs |
| ④ Weekly Learning | Opus 4.6 | Sundays | Reads full history, proposes knowledge base updates and system improvements |

Requires: Kaito AI · X API connector · Tavily

→ [Full documentation](./plugins/v3-daily-kol/)

---

## What's Inside

### 🔌 MCP Connectors

| Connector | Best for | Cost | Filtering |
|-----------|----------|------|-----------|
| [Kaito AI MCP](./connectors/kaito-mcp/) | Narrative discovery, mindshare tracking, KOL signals, sentiment | Paid API | Excellent |
| [Native X AI MCP](./connectors/x-research-mcp/) | Broad X/Twitter search, topic discovery | 💸 Expensive | Excellent |
| [Netrows X MCP](./connectors/netrows-x-mcp/) | Pulling KOL tweets, account research | ✅ Free tier + good value | Limited |
| [Tavily MCP](./connectors/tavily-mcp/) | Web context, TVL data, DeFi research | ✅ Generous free tier | N/A |

**When to use which:**

- **Kaito AI MCP** — purpose-built for crypto intelligence. Tracks narrative mindshare, token sentiment over time, smart follower signals, and KOL activity. The only connector that tells you what narratives are gaining or losing momentum across the whole market. Primary data source for V3 Daily KOL.
- **Native X AI MCP** — best-in-class topic search and filter criteria (likes, impressions, date ranges). Ideal for broad signal discovery when you want to go deeper on a specific topic or timeframe. Use it when quality of results matters most and cost isn't a constraint.
- **Netrows X MCP** — great free tier and solid overall value. Filtering is more limited but it excels at pulling tweets from individual accounts and KOLs. The go-to for account-level research without needing an X developer account.
- **Tavily** — purpose-built for AI agents, not rate-limited like search engines. Best for pulling web context: protocol docs, TVL data from DeFiLlama, news articles, on-chain analytics. Use alongside an X connector for full coverage.

---

### 🛠️ Plugins

| Plugin | What it does |
|--------|-------------|
| [V3 Daily KOL](./plugins/v3-daily-kol/) | Personalized context database + 4-agent daily pipeline — discovers relevant narratives, generates replies and post recs |
| [Setup Skills Master MCP](./plugins/setup-skills-master-mcp/) | Installs the skills-master MCP server so Claude can discover and install skills from within any conversation. Run `/setup-skills-master-mcp` to start. |

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

### V3 Daily KOL

See the [full setup guide](./plugins/v3-daily-kol/). Requires Kaito AI, an X API connector, and Tavily — all configured via the connectors below.

---

### Kaito AI MCP — Claude Code

1. Get an API key at [kaito.ai](https://kaito.ai)
2. Add to `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "kaito": {
         "command": "npx",
         "args": ["-y", "kaito-mcp-server@latest"],
         "env": { "KAITO_API_KEY": "your-api-key-here" }
       }
     }
   }
   ```
3. Restart Claude Code.

→ [Full setup guide](./connectors/kaito-mcp/)

---

### Native X AI MCP — Claude.ai

1. Go to [Claude.ai → Settings → Connectors → Add custom connector](https://claude.ai/settings)
2. Paste:
   ```
   https://x-research-mcp.onrender.com/mcp
   ```
3. Ask Claude to call `setup_session` with your X bearer token — you'll get a permanent session URL.
4. Replace the URL with your session URL. Done.

→ [Full setup guide](./connectors/x-research-mcp/)

---

### Netrows X MCP — Claude Code or Claude.ai

1. Get a Netrows API key at [netrows.com](https://www.netrows.com)
2. Add to `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "netrows-x": {
         "url": "https://netrows-x-mcp.onrender.com/mcp?netrows_api_key=pk_live_YOUR_KEY"
       }
     }
   }
   ```
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
         "env": { "TAVILY_API_KEY": "tvly-YOUR_KEY_HERE" }
       }
     }
   }
   ```
3. Restart Claude Code.

> **nvm users:** Claude Code doesn't inherit your shell's PATH. Run `/setup-skills-master-mcp` for a guided fix.

→ [Full setup guide](./connectors/tavily-mcp/)

---

### Setup Skills Master MCP — Claude Code

```bash
curl -fsSL https://raw.githubusercontent.com/incyd/skills-master-mcp-setup-skill/main/install.sh | bash
```

Or via marketplace: `/setup-skills-master-mcp`

→ [Plugin docs](./plugins/setup-skills-master-mcp/)

---

## Repo Structure

```
connectors/
  kaito-mcp/               ← Kaito AI crypto intelligence (15 tools)
  x-research-mcp/          ← Native X AI MCP (bearer token, 5 tools)
  netrows-x-mcp/           ← Netrows X MCP (API key, 14 tools)
  tavily-mcp/              ← Tavily web search MCP
plugins/
  v3-daily-kol/            ← Personalized context DB + 4-agent daily pipeline
  setup-skills-master-mcp/ ← Claude Code skill + MCP installer
skills/
  skills-registry.json     ← Machine-readable source of truth (17 skills)
  README.md                ← Catalog grouped by category
  INSTALL.md               ← One-liner install commands
```

---

Updated weekly · Maintained by [incyd](https://github.com/incyd)
