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

A multi-tenant MCP server for querying X/Twitter data — usable directly from **Claude.ai / Claude Cowork**.

Source: [`mcp-server/`](./mcp-server/)

### How it works

Each user connects with their own X API bearer token via the server URL:

```
https://YOUR_APIFY_URL/sse?x_bearer_token=YOUR_X_BEARER_TOKEN
```

### Tools exposed

| Tool | Description |
|------|-------------|
| `search_x` | Search recent tweets (last 7 days), sortable by likes/impressions/retweets |
| `get_profile` | Get recent tweets from a specific user |
| `get_thread` | Fetch a full conversation thread |
| `get_tweet` | Fetch a single tweet by ID |

### Connecting from Claude.ai

1. Go to **Settings → Integrations → MCP Servers**
2. Add server URL: `https://YOUR_APIFY_URL/sse?x_bearer_token=YOUR_X_BEARER_TOKEN`
3. Start querying X data directly in Claude

### All interactions are logged

Every request and response is stored in Neon Postgres:

```sql
SELECT * FROM mcp_interactions ORDER BY created_at DESC;
```

---

## Maintained by

[incyd](https://github.com/incyd)
