# claude-crypto-research-tools

A curated marketplace of Claude Code plugins and MCP servers for crypto research.

---

## Claude Code Plugin Marketplace

Add this marketplace to Claude Code:

```
/plugin marketplace add incyd/marketplace-claude-crypto-research-tools
```

### Available plugins

| Plugin | Description |
|--------|-------------|
| `skills-master-mcp-setup-skill` | Install and configure the skills-master MCP server for Claude Code |

### Install a plugin

```
/plugin install skills-master-mcp-setup-skill@claude-crypto-research-tools
```

---

## X Research MCP Server

A multi-tenant MCP server for querying X/Twitter data — connect directly from **Claude.ai / Claude Cowork** using your own X API bearer token.

Hosted on Apify Standby. No code to run — just connect.

**Base URL:** `https://lovable-kite--marketplace-claude-crypto-research-tools.apify.actor`

### What it does

| Tool | Description |
|------|-------------|
| `setup_session` | Register your X API bearer token once — receive a permanent session URL you can reuse |
| `search_x` | Search recent tweets (last 7 days), filter by engagement, sort by likes / impressions / retweets |
| `get_profile` | Fetch recent tweets from any X user |
| `get_thread` | Retrieve a full conversation thread by tweet ID |
| `get_tweet` | Look up a single tweet by ID |

---

### Connecting from Claude.ai

#### Step 1 — Add the MCP server (first time only)

1. Go to **Claude.ai → Settings → Integrations → MCP Servers → Add server**
2. Paste the SSE URL with your Apify API token (required for private actor access):
   ```
   https://lovable-kite--marketplace-claude-crypto-research-tools.apify.actor/sse?token=YOUR_APIFY_TOKEN
   ```
   > Get your Apify token at [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations)

#### Step 2 — Register your X API bearer token (once)

3. In Claude, call:
   ```
   setup_session with bearer_token: AAAAAAAAAAAAAAAAAAAAAxxxx...
   ```
4. The tool returns a permanent `session_id`. Update your MCP server URL to:
   ```
   https://lovable-kite--marketplace-claude-crypto-research-tools.apify.actor/sse?token=YOUR_APIFY_TOKEN&session_id=YOUR_SESSION_ID
   ```

#### Step 3 — Done

Your X API bearer token is saved. You'll never need to enter it again — just use the session URL above in Claude.ai.

> **Where to find your X API bearer token:**
> [developer.twitter.com → Dashboard → your App → Keys and Tokens → Bearer Token](https://developer.twitter.com/en/portal/dashboard)

---

### Health check

```
GET https://lovable-kite--marketplace-claude-crypto-research-tools.apify.actor/health?token=YOUR_APIFY_TOKEN
```

---

### Privacy & logging

Every tool call (request, response, timestamp, session identifier) is logged to a private Neon Postgres database. Bearer tokens are stored only in the sessions table — never exposed in interaction logs.

---

## Maintained by

[incyd](https://github.com/incyd)
