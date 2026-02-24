# 📡 X Research MCP Connector

Give Claude direct access to X/Twitter. Ask questions in plain English — find trending narratives, track what people are saying about a topic, pull posts from specific accounts, dig into threads, or use live X data as part of a larger research workflow.

Deployed on **Render** · Connects to **Claude.ai** via MCP

---

## 💡 What you can do

Once connected, just talk to Claude naturally:

```
What are people on X saying about Solana this week?
```
```
Search for $ETH posts with over 500 likes from the last 24 hours
```
```
Get the latest tweets from @VitalikButerin
```
```
Pull this thread and summarize the key arguments: [tweet URL]
```
```
Find posts about the Bybit hack and sort by most engagement
```
```
Compare sentiment on X between $BTC and $ETH over the last 3 days
```

Claude handles the queries — you just ask.

---

## 🛠️ Available Tools

| Tool | What it does |
|------|-------------|
| `setup_session` | Register your X API bearer token once — receive a permanent session URL |
| `search_x` | Search recent posts (last 7 days) with filters for time, likes, impressions, retweets |
| `get_profile` | Pull recent posts from any X account |
| `get_thread` | Fetch a full conversation thread by tweet ID |
| `get_tweet` | Look up a single post by ID |

---

## ⚡ Setup (~5 minutes)

### Step 1 — Get your X API bearer token

A bearer token is a credential that lets the server read public X data on your behalf. You get one for free from X's developer portal.

1. Go to [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard) and sign in with your X account
2. Click **"+ Create Project"** → give it any name → select **"Exploring the API"** as your use case
3. Create an App inside the project
4. Go to your App → **"Keys and Tokens"** tab → find **"Bearer Token"** → click **"Generate"**
5. Copy the token — it starts with `AAAAAAAAAAAAAAAAAAAAAA...`

> Your bearer token gives read-only access to public posts. It cannot post, follow, or access private accounts.

---

### Step 2 — Add the MCP server to Claude.ai

1. Go to **Claude.ai → Settings → Integrations → MCP Servers → Add server**
2. Paste this URL:
   ```
   https://x-research-mcp.onrender.com/mcp
   ```

---

### Step 3 — Register your bearer token

3. In a Claude.ai conversation, ask Claude to call `setup_session` with your token:
   ```
   Call setup_session with bearer_token: AAAAAAAAAAAAAAAAAAAAAxxxx...
   ```
4. Claude will return a permanent `mcp_url` tied to your token.

---

### Step 4 — Save your session URL

5. In **Claude.ai → Settings → Integrations → MCP Servers**, replace the URL with your session URL:
   ```
   https://x-research-mcp.onrender.com/mcp?session_id=YOUR-SESSION-UUID
   ```
6. **Done.** Your token is saved — you'll never need to enter it again.

---

## 🔄 Returning Users

Your session URL works permanently. Just make sure it's set in **Claude.ai → Settings → Integrations → MCP Servers**:

```
https://x-research-mcp.onrender.com/mcp?session_id=YOUR-SESSION-UUID
```

---

## ⚠️ First Query After Idle

The server runs on Render's free tier and spins down after ~15 minutes of inactivity. **The first query after a period of inactivity may throw an error** — this is normal. Wait a few seconds and try again; the server will be warm and respond correctly from there on.

If you want to avoid this, visit the health endpoint before starting to pre-warm the server:

```
https://x-research-mcp.onrender.com/health
```

---

## 🔒 Privacy & Logging

Every tool call (tool name, arguments, response, timestamp, session ID) is stored in a private Postgres database for debugging and usage tracking. Bearer tokens are stored in a separate sessions table and are never included in interaction logs.
