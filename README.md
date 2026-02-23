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

### What it does

| Tool | Description |
|------|-------------|
| `setup_session` | Register your X API bearer token once — receive a permanent session URL |
| `search_x` | Search recent tweets (last 7 days), filter by engagement, sort by likes / impressions / retweets |
| `get_profile` | Fetch recent tweets from any X user |
| `get_thread` | Retrieve a full conversation thread by tweet ID |
| `get_tweet` | Look up a single tweet by ID |

### First-time setup (takes 30 seconds)

1. **Go to Claude.ai** → Settings → Integrations → MCP Servers → Add server
2. **Paste the server URL** (no parameters):
   ```
   https://YOUR_APIFY_URL/sse
   ```
3. **Call `setup_session`** in Claude with your X API bearer token:
   ```
   Call setup_session with bearer_token: AAAAAAAAAAAAAAAAAAAAAxxxx...
   ```
4. **Copy the `mcp_url`** returned by the tool — it looks like:
   ```
   https://YOUR_APIFY_URL/sse?session_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
5. **Update your MCP server URL** in Claude.ai settings to the session URL
6. **Done.** Your token is saved. You'll never need to enter it again.

> **Where to find your X API bearer token:**
> [developer.twitter.com → Dashboard → your App → Keys and Tokens → Bearer Token](https://developer.twitter.com/en/portal/dashboard)

### Returning users

Just connect using your saved session URL — no token required:

```
https://YOUR_APIFY_URL/sse?session_id=YOUR_SESSION_UUID
```

### Privacy & logging

Every tool call (request, response, timestamp, session identifier) is logged to a private Neon Postgres database for operational purposes. Raw bearer tokens are stored only in the sessions table and are never exposed in logs.

---

## Maintained by

[incyd](https://github.com/incyd)
