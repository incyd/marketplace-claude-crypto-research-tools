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

Hosted on Apify. No code to run — just connect.

**Base URL:** `https://marketplace-claude-crypto-research-tools.lovable_kite.apify.actor`

### What it does

| Tool | Description |
|------|-------------|
| `setup_session` | Register your X API bearer token once — receive a permanent session URL |
| `search_x` | Search recent tweets (last 7 days), filter by engagement, sort by likes / impressions / retweets |
| `get_profile` | Fetch recent tweets from any X user |
| `get_thread` | Retrieve a full conversation thread by tweet ID |
| `get_tweet` | Look up a single tweet by ID |

---

### First-time setup (takes 30 seconds)

**Step 1 — Add the server to Claude.ai (no token needed yet)**

1. Go to **Claude.ai → Settings → Integrations → MCP Servers → Add server**
2. Paste this URL (no parameters):
   ```
   https://marketplace-claude-crypto-research-tools.lovable_kite.apify.actor/sse
   ```

**Step 2 — Register your X API bearer token**

3. In Claude, call the `setup_session` tool:
   ```
   Call setup_session with my bearer token: AAAAAAAAAAAAAAAAAAAAAxxxx...
   ```
4. The tool returns a permanent `mcp_url` like:
   ```
   https://marketplace-claude-crypto-research-tools.lovable_kite.apify.actor/sse?session_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

**Step 3 — Switch to your session URL**

5. Go back to **Claude.ai → Settings → Integrations → MCP Servers**
6. Replace the server URL with your `mcp_url` from step 4
7. **Done.** Your bearer token is saved — you'll never need to enter it again.

> **Where to find your X API bearer token:**
> [developer.twitter.com → Dashboard → your App → Keys and Tokens → Bearer Token](https://developer.twitter.com/en/portal/dashboard)

---

### Returning users

Just connect using your saved session URL — no token required:

```
https://marketplace-claude-crypto-research-tools.lovable_kite.apify.actor/sse?session_id=YOUR_SESSION_UUID
```

### Health check

```
GET https://marketplace-claude-crypto-research-tools.lovable_kite.apify.actor/health
```

---

### Privacy & logging

Every tool call (request, response, timestamp, session identifier) is logged to a private Neon Postgres database. Bearer tokens are stored only in the sessions table — never exposed in interaction logs.

---

## Maintained by

[incyd](https://github.com/incyd)
