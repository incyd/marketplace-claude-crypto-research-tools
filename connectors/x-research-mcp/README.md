# 📡 X Research MCP Connector

A **multi-tenant MCP server** for querying X/Twitter data — connect directly from **Claude.ai** using your own X API bearer token. No Apify account, no login, no friction.

Deployed on **Render**

---

## 🛠️ Tools

| Tool | Description |
|------|-------------|
| `setup_session` | Register your X API bearer token once — receive a permanent session URL |
| `search_x` | Search recent tweets (last 7 days), sortable by likes / impressions / retweets |
| `get_profile` | Get recent tweets from any X/Twitter user |
| `get_thread` | Fetch a full conversation thread by tweet ID |
| `get_tweet` | Look up a single tweet by ID |

---

## ⚡ Setup (~30 seconds)

### Step 1 — Add the MCP server to Claude.ai

1. Go to **Claude.ai → Settings → Integrations → MCP Servers → Add server**
2. Paste this URL *(no account or login required)*:
   ```
   https://x-research-mcp.onrender.com/mcp
   ```

### Step 2 — Register your X API bearer token

3. Ask Claude to call `setup_session` with your token:
   ```
   Call setup_session with bearer_token: AAAAAAAAAAAAAAAAAAAAAxxxx...
   ```
4. You'll receive a permanent `session_id` and a ready-to-use `mcp_url`.

### Step 3 — Save your session URL

5. In **Claude.ai → Settings → Integrations → MCP Servers**, replace the URL with your session URL:
   ```
   https://x-research-mcp.onrender.com/mcp?session_id=YOUR-SESSION-UUID
   ```
6. **Done.** Your bearer token is saved — you'll never need to enter it again.

> **Get your X API bearer token:**
> [developer.twitter.com → Dashboard → your App → Keys and Tokens → Bearer Token](https://developer.twitter.com/en/portal/dashboard)

---

## 🔄 Returning Users

Use your saved session URL directly:

```
https://x-research-mcp.onrender.com/mcp?session_id=YOUR-SESSION-UUID
```

---

## 💡 Usage Examples

Once connected, just ask Claude naturally:

```
Search X for $SOL narratives in the last 24h, sorted by likes
```

```
Get recent tweets from @VitalikButerin
```

```
What's the thread starting from tweet ID 1234567890?
```

---

## 🔍 Health Check

```
GET https://x-research-mcp.onrender.com/health
```

> **Note:** The server runs on Render's free tier and may spin down after ~15 minutes of inactivity. The first connection after idle can take 30–60 seconds. Visit the health endpoint to pre-warm it.

---

## 🔒 Privacy & Logging

Every tool call (tool name, request, response, timestamp, session ID) is stored in a private Postgres database. Raw bearer tokens are stored only in the sessions table — never in interaction logs.
