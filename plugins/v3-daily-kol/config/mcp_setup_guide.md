# MCP Connector Setup Guide

> **Purpose**: Step-by-step instructions for connecting the external data sources required by V3 Daily Environment_User. Read this before running `/setup` for the first time.
>
> **Who this is for**: Any user installing V3 Daily Environment_User in their own Cowork environment.
>
> **How `/setup` uses this**: The `/setup` command auto-detects which connectors are available by testing lightweight API calls. It does NOT rely on hardcoded connector IDs — every Cowork environment assigns its own internal IDs. This guide helps you get the connectors installed so `/setup` can find them.

---

## Quick Overview

V3 requires **three mandatory connectors** and supports **one optional** connector:

| Connector | Required? | What It Does | API Key Needed? |
|-----------|-----------|-------------|-----------------|
| X Account Tools (Connector B) | ✅ Yes | Tweet retrieval, user profiles, timelines, threads, full tweet fetch | Yes — X API Bearer Token |
| Kaito AI Crypto Intelligence | ⚠️ Conditional | **Primary for Mode A keyword search** + mindshare, sentiment, smart engagement | Yes — Kaito API Key |
| Tavily Web Research | ✅ Yes | Web search, article extraction, deep research | Yes — Tavily API Key |
| X Search API (Connector A) | ⚠️ Conditional | Keyword-based tweet search (**fallback only** — used when Kaito+B both fail) | Yes — X API Bearer Token |

> **Why Kaito + Connector B for keyword search?** Kaito `kaito_advanced_search` is the primary discovery tool for Mode A (topic keywords). It filters org spam at source (`author_type: "Individual"`), provides smart engagement signals, and uses AI summaries. Kaito returns tweet URLs, which are then fed to Connector B `get_tweet_thread` for full tweet copy. This eliminates the need for expensive Connector A `search_x` in most runs. Connector A remains as a last-resort fallback.
>
> **Can I run without Kaito?** Yes — the system falls back to Connector B `search_tweets` (Tier 1 fallback) and then Connector A `search_x` (Tier 2 fallback). But Kaito provides better discovery quality and lower cost, so it's strongly recommended.

---

## Step 1: Get Your X API Credentials

Both X connectors (A and B) require an X API Bearer Token. You may be able to use the same token for both, or you may need separate ones depending on which MCP providers you use.

### How to Get an X API Bearer Token

1. Go to the [X Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Sign in with your X account
3. If you don't have a developer account, apply for one:
   - Select "Free" tier (sufficient for basic usage) or "Basic" tier ($100/month for higher limits)
   - Free tier gives you 10,000 tweet reads/month and 1,500 posts/month
   - Basic tier gives you 50,000 tweet reads/month and 3,000 posts/month
4. Create a new Project and App
5. In your App settings, go to **Keys and Tokens**
6. Generate a **Bearer Token** — this is what you'll use
7. Copy and save the token somewhere secure — you can't view it again after leaving the page

> **Which tier do you need?** With Kaito as primary for Mode A, Connector A usage is minimal (fallback only). Free tier is typically sufficient for a single account. For 2+ accounts or if running without Kaito (so Connector A handles all keyword search), Basic tier is recommended.

---

## Step 2: Get Your Tavily API Key

1. Go to [tavily.com](https://tavily.com)
2. Create an account (free tier available)
3. Navigate to your [API Keys page](https://app.tavily.com/home)
4. Copy your API key

> **Free tier limits**: 1,000 API credits/month. Each search costs 1 credit. Each extract costs 1-5 credits depending on depth. This is typically more than enough for V3 Daily Environment_User usage.

---

## Step 3: Get Your Kaito API Key (Recommended — Primary for Mode A)

Kaito is the **primary tool for Mode A keyword search** via `kaito_advanced_search`. It also provides crypto-specific intelligence — narrative mindshare, sentiment tracking, smart engagement analytics. Without it, the system falls back to Connector B `search_tweets` and then Connector A `search_x`, which still works but with less filtering and higher cost.

1. Go to [kaito.ai](https://kaito.ai)
2. Sign up for an API account
3. Navigate to your API settings
4. Copy your API key

> **Rate limit**: Kaito allows ~80 API requests per day. Mode A uses ~6-10 calls/day (8-12% of the budget). The system tracks usage across all agents and stops calling Kaito when approaching the limit.

> **If you don't have Kaito**: The system will fall back to Connector B `search_tweets` for Mode A keyword search (Tier 1 fallback), and then Connector A `search_x` if needed (Tier 2 fallback). Core functionality is preserved, but you lose org-spam filtering, smart engagement signals, and AI summaries. Strongly recommended for best results.

---

## Step 4: Connect the MCP Servers in Cowork

With your API keys ready, connect each service in your Cowork environment:

### 4.1 Connecting Connector B (X Account Tools)

This connector needs to provide these tools: `get_user_tweets`, `get_user_info`, `search_tweets`, `get_user_followers`, `get_user_following`, `get_tweet_thread`, `get_tweet_replies`, `get_tweet_quotes`, `get_trending_topics`, `search_users`

**In Cowork:**

1. Open your Cowork MCP connector settings
2. Search for an X/Twitter connector that provides account-level tools (timeline pulls, user info, thread retrieval)
3. Connect it using your X API Bearer Token
4. Verify it appears in your connected services list

### 4.2 Connecting Connector A (X Search API)

This connector needs to provide this tool: `search_x` (keyword-based tweet search with sort and filter options)

**In Cowork:**

1. Open your Cowork MCP connector settings
2. Search for an X/Twitter search connector that provides `search_x` functionality
3. Connect it using your X API Bearer Token
4. Verify it appears in your connected services list

> **Note**: Some MCP providers bundle both account tools and search into one connector. If yours does, that's fine — `/setup` will detect the tools regardless of which connector provides them. The "Connector A / Connector B" naming is functional, not about specific providers.

### 4.3 Connecting Tavily

1. Open your Cowork MCP connector settings
2. Search for "Tavily" — it's a common MCP connector
3. Connect it using your Tavily API key
4. Verify it appears in your connected services list

> **Multiple Tavily instances**: If your Cowork environment shows two Tavily connectors, `/setup` will test both and use whichever one responds. You only need one working instance.

### 4.4 Connecting Kaito (Optional)

1. Open your Cowork MCP connector settings
2. Search for "Kaito" or "Kaito AI"
3. Connect it using your Kaito API key
4. Verify it appears in your connected services list

---

## Step 5: Run `/setup`

With connectors installed, run the `/setup` command. It will:

1. **Auto-detect connectors** by testing lightweight API calls (no hardcoded IDs needed)
2. **Verify each tool works** with a minimal test call
3. **Create workspace directories** (`account_data/` with subdirs: `profile/`, `data/`, `knowledge/`, `output/`, `analytics/`, `logs/`, `weekly/`)
4. **Seed the knowledge base** (copies `seeds/web3_knowledge_base_seed.md` → `account_data/knowledge/web3_knowledge_base.md`)
5. **Report status** with a clear pass/fail table

### What `/setup` Tests

| Connector | Test Call | What It Checks |
|-----------|----------|----------------|
| Connector B | `get_user_info(userName: "ethereum")` | Can retrieve user profiles |
| Connector A | `search_x(query: "ethereum", sort: "impressions")` | Can perform keyword searches |
| Tavily | `tavily_search(query: "ethereum 2026")` | Can perform web searches |
| Kaito | `kaito_mindshare(token: "ETH")` | Can retrieve mindshare data |

If any required connector fails, `/setup` will tell you exactly what's missing and what tools to look for when connecting.

---

## Tool Reference

### Connector B — X Account Tools

| Tool | What It Does | Which Agent Uses It |
|------|-------------|---------------------|
| `get_user_tweets` | Pull a user's recent originals + quote tweets (~20 per call; no replies, no pure RTs). Pagination has ~75% overlap — dedup by tweet ID | Agent ② (daily TL pulls in Mode B, own posts in Mode C) |
| `get_user_info` | Get user metadata (bio, follower count, etc.) | Agent ① (onboarding), Agent ② (author context) |
| `search_tweets` | Search tweets with operators (e.g., `from:user`, `until:date`) — returns all types incl. replies | **Agent ① (onboarding: 200-post pull via `from:{handle}` + date windowing)**, Agent ② (Mode A Fallback Tier 1 if Kaito unavailable) |
| `get_user_followers` | List a user's followers | Agent ① (competitor/TL discovery) |
| `get_user_following` | List who a user follows | Agent ① (following-list analysis) |
| `get_tweet_thread` | Get full thread for a tweet | **Agent ② (Mode A: fetch full tweets from Kaito URLs)**, Agent ② (thread context), Agent ③ (reply context) |
| `get_tweet_replies` | Get replies to a tweet | Agent ② (engagement signals), Agent ③ (reply context) |
| `get_tweet_quotes` | Get quote tweets | Agent ③ (quote tweet context) |
| `get_trending_topics` | Current trending topics | Agent ② (trend reference) |
| `search_users` | Search for users by name/keyword | Agent ① (onboarding) |

### Connector A — X Search API (⚠️ FALLBACK ONLY)

| Tool | What It Does | Status |
|------|-------------|--------|
| `search_x` | Keyword-based tweet search with sort/filter | ⚠️ **LAST RESORT FALLBACK** — only used when both Kaito and Connector B `search_tweets` fail |
| `get_profile` | Profile lookup | ⚠️ Known to return errors on many providers — use Connector B `get_user_info` instead |
| `get_thread` | Thread retrieval | ⚠️ Known to return errors on many providers — use Connector B `get_tweet_thread` instead |
| `get_tweet` | Individual tweet lookup | ❌ Do NOT use — cost rule prohibits; always use Connector B for tweet retrieval |

> **Cost rule**: Connector A's search API is expensive. With Kaito as primary for Mode A keyword search, Connector A is now the **last-resort fallback** — only activated if both Kaito and Connector B `search_tweets` fail. This dramatically reduces Connector A usage and cost.

### Tavily — Web Research

| Tool | What It Does | Which Agent Uses It |
|------|-------------|---------------------|
| `tavily_search` | Quick web searches | Agent ① (topic enrichment), Agent ③ (ad-hoc context), Agent ④ (trend validation) |
| `tavily_research` | Deep multi-source research | Agent ① (onboarding research), Agent ④ (weekly deep dives) |
| `tavily_extract` | Extract content from specific URLs | Agent ③ (article analysis for engagement content) |
| `tavily_crawl` | Crawl a site for structured data | Agent ④ (protocol documentation crawling) |
| `tavily_map` | Map a site's URL structure | Rarely used |

### Kaito AI — Crypto Intelligence (Primary for Mode A)

| Tool | What It Does | Which Agent Uses It |
|------|-------------|---------------------|
| `kaito_advanced_search` | AI-summarized crypto topic discovery with org filtering and smart engagement | **Agent ② (Mode A primary keyword search — ~6-10 calls/day)**, Agent ① (narrative research during onboarding) |
| `kaito_mindshare` | Token mindshare over time | Agent ④ (weekly trend tracking) |
| `kaito_sentiment` | Bullish/bearish sentiment trends | Agent ④ (weekly sentiment analysis) |
| `kaito_mentions` | Mention volume by source (Twitter, Discord, News) | Agent ④ (cross-platform signal) |
| `kaito_engagement` | Smart engagement metrics | Agent ③ (post selection scoring) |
| `kaito_events` | Upcoming catalyst events per token | Agent ③ (timely content hooks), Agent ④ (event tracking) |
| `kaito_mindshare_arena` | Project rankings by mindshare | Agent ④ (weekly competitive landscape) |
| `kaito_smart_followers` | Smart follower count and list | Agent ① (account quality assessment), Agent ④ (growth tracking) |
| `kaito_smart_following` | Who a user's smart followers follow | Agent ① (competitor/TL discovery) |
| `kaito_tweet_engagement_info` | Detailed per-tweet engagement breakdown | Agent ③ (engagement analysis) |

**Kaito fallbacks when not connected:**

| Kaito Tool | Fallback |
|-----------|----------|
| `kaito_advanced_search` (Mode A primary) | **Tier 1**: Connector B `search_tweets` → **Tier 2**: Connector A `search_x` (last resort) |
| `kaito_advanced_search` (narrative research) | `tavily_research` for narrative context |
| `kaito_mindshare` | `tavily_search` for trend validation |
| `kaito_engagement` | No replacement — scoring uses Connector B metrics only |
| `kaito_sentiment` | No replacement — skip sentiment section in weekly report |

---

## Rate Limits

| Connector | Daily Budget | Per-Call Limit | Notes |
|-----------|-------------|----------------|-------|
| Connector B | No hard daily cap | ~20 tweets per call (`get_user_tweets` or `search_tweets`) | `get_user_tweets` returns originals + QTs (no replies, no pure RTs); `search_tweets` returns all types. Pagination overlap ~75% on `get_user_tweets` — dedup by ID. Respect X API monthly limits |
| Kaito | Max 80 requests/day (all agents combined) | Varies by tool | Mode A uses ~6-10/day. Agents track cumulative usage |
| Connector A | Max 10 `search_x` calls/day (**fallback only**) | ~20 results per search | Expensive — last-resort fallback for keyword search |
| Tavily | ~1,000 credits/month (free tier) | Varies by operation | Generous for typical usage |

---

## Connector Decision Tree

When multiple connectors could serve the same need, agents follow this hierarchy:

```
Need to SEARCH by keyword?
  → Kaito: kaito_advanced_search (PRIMARY — author_type: "Individual", sort_by: "engagement")
    → Extract tweet IDs from URLs → Connector B: get_tweet_thread (fetch full tweet copy)
  → Connector B: search_tweets (FALLBACK TIER 1 — if Kaito unavailable)
  → Connector A: search_x (LAST RESORT TIER 2 — expensive, only if both above fail)

Need to PULL tweets for a specific account?
  → ONBOARDING (200 posts): Connector B: search_tweets with "from:{handle}" + date windowing
     (get_user_tweets returns originals + QTs only — no replies, no pure RTs)
  → DAILY PULLS (recent ~20): Connector B: get_user_tweets (originals + QTs; sufficient for Mode B/C — dedup by ID if paginating)

Need INDIVIDUAL tweet data (threads, replies)?
  → Connector B: get_tweet_thread / get_tweet_replies (NEVER Connector A)

Need USER metadata (bio, followers)?
  → Connector B: get_user_info (ONLY option)

Need CRYPTO-SPECIFIC analytics?
  → Kaito (if available) — mindshare, sentiment, smart engagement
  → Tavily (fallback) — web research for narrative context

Need WEB RESEARCH for enrichment?
  → Tavily: tavily_research / tavily_search (ONLY option)
```

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| `/setup` can't find Connector B tools | MCP connector not installed or wrong connector type | Check Cowork MCP settings — you need a connector that provides `get_user_tweets` and `get_user_info` |
| `/setup` can't find `search_x` | Connector A not installed | Install an X Search API connector in Cowork MCP settings |
| `search_x` returns empty results | Keywords too niche or misspelled | Try broader terms; this is normal for very specific queries |
| `get_user_tweets` returns empty | Account is private/suspended OR account posts mostly replies (which `get_user_tweets` excludes — it only returns originals + QTs) | For daily pulls: expected if account posts mostly replies. For onboarding: use `search_tweets` with `from:{handle}` instead (returns all tweet types) |
| `get_user_tweets` pagination duplicates | Normal — ~75% overlap between consecutive pages | Dedup by tweet ID. Page 1 gives ~20 unique posts; page 2 may only add ~5 new ones. For daily pulls, page 1 is usually sufficient |
| `search_tweets` pagination stalls | Normal — cursor pagination exhausts within ~7-day search windows | Shift window backwards using `until:YYYY-MM-DD` operator. See `config/agent_onboarding.md` Step 1b algorithm |
| Tavily returns 500 errors | API key expired or wrong instance | Check your Tavily API key; if multiple instances exist, `/setup` tries all of them |
| Kaito rate limit exceeded | >80 calls in a day | System auto-stops Kaito calls; uses fallbacks until next day |
| Bearer token rejected | Token expired or revoked | Regenerate token at [X Developer Portal](https://developer.x.com/en/portal/dashboard) |
| "Connector not found" after installation | Cowork may need a refresh | Close and reopen the Cowork session; MCP connectors load at session start |
