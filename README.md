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

A **multi-tenant MCP server** for querying X/Twitter data — connect directly from **Claude.ai** using your own X API bearer token. No Apify account, no login, no friction.

Source: [`mcp-server/`](./mcp-server/)
Deployed on: **Render**

### What it does

| Tool | Description |
|------|-------------|
| `setup_session` | Register your X API bearer token once — receive a permanent session URL |
| `search_x` | Search recent tweets (last 7 days), sortable by likes / impressions / retweets |
| `get_profile` | Get recent tweets from any X/Twitter user |
| `get_thread` | Fetch a full conversation thread by tweet ID |
| `get_tweet` | Look up a single tweet by ID |

---

### Connecting from Claude.ai — first time (30 seconds)

**Step 1** — Add the MCP server to Claude.ai:

1. Go to **Claude.ai → Settings → Integrations → MCP Servers → Add server**
2. Paste this URL *(no account or login required)*:
   ```
   https://x-research-mcp.onrender.com/sse
   ```

**Step 2** — Register your X API bearer token (once):

3. Ask Claude to call `setup_session` with your token:
   ```
   Call setup_session with bearer_token: AAAAAAAAAAAAAAAAAAAAAxxxx...
   ```
4. You'll receive a permanent `session_id` and a ready-to-use `mcp_url`.

**Step 3** — Save your session URL:

5. In Claude.ai → Settings → Integrations → MCP Servers, replace the URL with your session URL:
   ```
   https://x-research-mcp.onrender.com/sse?session_id=YOUR-SESSION-UUID
   ```
6. **Done.** Your X API bearer token is saved. You'll never need to enter it again.

> **Get your X API bearer token:**
> [developer.twitter.com → Dashboard → your App → Keys and Tokens → Bearer Token](https://developer.twitter.com/en/portal/dashboard)

---

### Returning users

Just use your saved session URL in Claude.ai:

```
https://x-research-mcp.onrender.com/sse?session_id=YOUR-SESSION-UUID
```

---

### Health check

```
GET https://x-research-mcp.onrender.com/health
```

---

### Self-hosting

The server can be self-hosted on any platform that supports Docker or Node 20+.

```bash
# Clone, install, build
cd mcp-server
npm install && npm run build

# Configure
export DATABASE_URL="postgresql://..."
export PUBLIC_URL="https://your-domain.com"

# Run
node dist/index.js
```

See [`mcp-server/render.yaml`](./mcp-server/render.yaml) for a one-click Render deploy config.

---

### Privacy & logging

Every tool call (tool name, request, response, timestamp, session ID) is stored in a private Neon Postgres database. Raw bearer tokens are stored only in the sessions table — never in interaction logs.

---

## Maintained by

[incyd](https://github.com/incyd)
