# /setup — V3 Daily Environment_User Environment Initialization

> **Purpose**: First-run initialization command. Auto-detects MCP connectors, creates workspace directories, seeds the knowledge base, and reports ready state.
>
> **Idempotent**: Safe to run multiple times. Never overwrites existing data.
>
> **Prerequisites**: Before running `/setup`, install your MCP connectors following the instructions in `config/mcp_setup_guide.md`. That guide explains how to get API keys and connect each service.

---

## Step 1: Auto-Detect and Verify MCP Connectors

Detect available MCP connectors by testing lightweight API calls. Do NOT rely on hardcoded connector IDs — each Cowork environment assigns its own internal IDs. Instead, discover connectors by calling the expected tools and checking which ones respond.

### 1.1 Connector B — X Account Tools (REQUIRED)

**How to detect**: Search the available MCP tools for `get_user_info`. The connector that provides this tool is Connector B.

**Test**: Call `get_user_info(userName: "ethereum")`

**Expected**: Response containing `userName`, `followers`, `description` fields.

**If succeeds**: Record the connector's internal ID for this session. Report "✅ Connector B (X Account Tools) — connected"

**If fails**: Report "❌ Connector B (X Account Tools) — NOT CONNECTED. See `config/mcp_setup_guide.md` Step 4.1 for installation instructions. This connector must provide: `get_user_tweets`, `get_user_info`, `search_tweets`, `get_user_followers`, `get_user_following`, `get_tweet_thread`, `get_tweet_replies`."

### 1.2 Connector A — X Search API (CONDITIONAL — required only if Kaito unavailable)

**How to detect**: Search the available MCP tools for `search_x`. The connector that provides this tool is Connector A.

**Test**: Call `search_x(query: "ethereum", sort: "impressions")`

**Expected**: Response containing tweet results.

**If succeeds**: Record the connector's internal ID for this session. Report "✅ Connector A (X Search API) — connected (last-resort fallback for Mode A)"

**If fails/unavailable**: Report "⚠️ Connector A (X Search API) — not connected. If Kaito is connected, this is fine — Kaito is primary for Mode A. If Kaito is also unavailable, Mode A falls back to Connector B `search_tweets` only. See `config/mcp_setup_guide.md` Step 4.2 for installation."

> **Note**: If a single connector provides BOTH `get_user_info` AND `search_x`, that's fine. It serves as both Connector A and B. The naming is functional, not about requiring two separate providers.

### 1.3 Tavily — Web Research (REQUIRED)

**How to detect**: Search the available MCP tools for `tavily_search`. If multiple Tavily instances exist, test each one.

**Test**: Call `tavily_search(query: "ethereum 2026")`

**Expected**: Search results with URLs and snippets.

**If multiple instances exist**: Test each one. Use the first instance that returns a valid response. Record its internal ID.

**If succeeds**: Report "✅ Tavily (Web Research) — connected"

**If all fail**: Report "❌ Tavily (Web Research) — NOT CONNECTED. See `config/mcp_setup_guide.md` Step 4.3 for installation instructions. This connector must provide: `tavily_search`, `tavily_research`."

### 1.4 Kaito — Crypto Intelligence (RECOMMENDED — Primary for Mode A)

**How to detect**: Search the available MCP tools for `kaito_mindshare`.

**Test**: Call `kaito_mindshare(token: "ETH")`

**Expected**: Mindshare data response.

**If succeeds**: Report "✅ Kaito AI (Crypto Intelligence) — connected (primary for Mode A keyword search)"

**If fails/unavailable**: Report "⚠️ Kaito AI — not connected. Mode A keyword search will fall back to Connector B `search_tweets` → Connector A `search_x`. See `config/mcp_setup_guide.md` Step 3 for installation. Recommended for optimal Mode A performance."

### 1.5 Connector Status Summary

After testing all connectors, display a summary table:

```
┌─────────────────────────────────────────────────┐
│           V3 Daily Environment_User — Connector Status        │
├───────────────┬──────────┬──────────────────────┤
│ Connector     │ Status   │ Role                 │
├───────────────┼──────────┼──────────────────────┤
│ Connector B   │ ✅ / ❌   │ Tweet retrieval (REQUIRED)           │
│ Tavily        │ ✅ / ❌   │ Web research (REQUIRED)              │
│ Kaito         │ ✅ / ⚠️   │ Mode A primary + crypto (RECOMMENDED)│
│ Connector A   │ ✅ / ⚠️   │ Keyword search fallback (CONDITIONAL)│
└───────────────┴──────────┴──────────────────────┘
```

**Gate logic:**
- **Connector B** missing → STOP. Cannot proceed.
- **Tavily** missing → STOP. Cannot proceed.
- **Both Kaito AND Connector A** missing → STOP. At least one keyword search source is required for Mode A. Direct user to install Kaito (recommended) or Connector A (fallback).
- **Kaito** missing but **Connector A** present → WARN. Mode A falls back to Connector B `search_tweets` → Connector A `search_x`. Proceed.
- **Connector A** missing but **Kaito** present → OK. Kaito handles Mode A primary. Proceed.

**If any blocking condition is met**: Stop here. Display which connectors need to be connected and direct the user to `config/mcp_setup_guide.md` for installation instructions. Do not proceed to Step 2.

### 1.6 Write Connector IDs to CLAUDE.md

After successful detection, write the discovered connector IDs into `CLAUDE.md` Section 2.1 — the connector allocation table. This is how all agents know which MCP prefix to use at runtime.

**Process:**

1. Read `CLAUDE.md` Section 2.1
2. Update the `ID` column in the connector table with the discovered IDs
3. For each connector that responded successfully, write its MCP internal ID (the UUID portion from the tool's namespace, e.g., `mcp__<UUID>__tool_name` → write `<UUID>`)
4. For connectors that failed or returned errors (e.g., a second Tavily instance that 500s), mark them in the table with a note: "DO NOT USE — returns errors in this environment"
5. For Kaito, if not available, leave the ID column as `—` and note "not connected — Mode A will use fallback chain"
6. Save `CLAUDE.md`

**Example result in CLAUDE.md after `/setup`:**

```
| Connector | ID | Detected By | Role | Cost |
|-----------|-----|-------------|------|------|
| **Connector B** | `abc12345` | Provides `get_user_info` | ALL tweet retrieval... | Standard |
| **Connector A** | `def67890` | Provides `search_x` | Keyword search ONLY... | Expensive |
| **Tavily** | `fed98765` | Provides `tavily_search` | Web3 research... | Standard |
| **Kaito** | `Kaito_AI` | Provides `kaito_mindshare` | Primary Mode A + crypto intel... | Premium |
```

**On re-run**: `/setup` overwrites the ID column with fresh values. This handles cases where the user reconnects a service and gets a new ID.

---

## Step 2: Create Workspace Directories

Create the following directories if they don't already exist:

```
account_data/              # Account data root — flat structure (one instance per deployment)
account_data/profile/      # Account profile (Agent ① output)
account_data/data/         # Append-only data files (daily_posts.json, own_posts.jsonl)
account_data/knowledge/    # Runtime knowledge base (evolving copy, seeded in Step 3)
account_data/output/       # Agent ③ output (engagement_replies.xlsx, own_post_recs.xlsx)
account_data/analytics/    # Analytics history (analytics_history.jsonl)
account_data/logs/         # Agent completion reports (agent_1-4_log.txt)
account_data/weekly/       # Agent ④ weekly reports and proposals
account_data/weekly/knowledge_edit_proposals/    # Weekly KB edit diffs
account_data/weekly/effectiveness_reports/       # Weekly proposed-vs-actual reports
account_data/weekly/own_post_recs_archive/       # Daily own_post_recs snapshots
account_data/weekly/claude_md_proposals/         # Weekly CLAUDE.md learning log proposals
```

**Check**: If directories already exist, skip creation and report "Workspace directories already exist — skipping."

---

## Step 3: Seed Knowledge Base

Copy `seeds/web3_knowledge_base_seed.md` → `account_data/knowledge/web3_knowledge_base.md`

**Critical**: If `account_data/knowledge/web3_knowledge_base.md` already exists, **DO NOT overwrite it**. The user's evolved knowledge base is more valuable than the seed. Report "Knowledge base already exists — skipping seed copy (existing KB preserved)."

**If seed doesn't exist**: Report error "seeds/web3_knowledge_base_seed.md not found — cannot seed knowledge base. Check that the project files are intact."

**If knowledge base doesn't exist**: Copy the seed and report "✅ Knowledge base seeded from web3_knowledge_base_seed.md"

---

## Step 4: Report Ready State

Display final status:

```
┌─────────────────────────────────────────────────┐
│         V3 Daily Environment_User — Environment Ready         │
├─────────────────────────────────────────────────┤
│                                                   │
│  Connectors:  {N}/2 required connected            │
│               Kaito: {connected (Mode A primary) / not connected (fallback mode)} │
│               Connector A: {connected (fallback) / not needed (Kaito active)} │
│                                                   │
│  Workspace:   Directories ready                   │
│  Knowledge:   {Seeded / Already exists}           │
│                                                   │
│  Next step:   Run /onboard @handle to set up      │
│               your first account                  │
│                                                   │
└─────────────────────────────────────────────────┘
```

If Connector B + Tavily connected AND (Kaito OR Connector A) connected:
- "✅ Environment is ready. Run `/onboard @handle` to onboard your first Environment_User account."

If Connector B or Tavily missing:
- "❌ Environment not ready — required connectors missing. See `config/mcp_setup_guide.md` for installation instructions, then run `/setup` again."

If both Kaito and Connector A missing:
- "⚠️ Environment partially ready — no keyword search source available. Install Kaito (recommended) or Connector A (fallback). See `config/mcp_setup_guide.md`."

---

## Error Handling

| Error | Action |
|-------|--------|
| Connector test times out | Retry once. If still fails, mark as ❌ |
| Connector returns unexpected format | Mark as ⚠️ with note "connected but returned unexpected response — verify manually" |
| File system permission error | Report error with path — user may need to check Cowork folder permissions |
| Seed file missing | Report error — project files may be incomplete |
| Multiple connectors provide same tool | Use the first one that returns valid results; note which one was selected |

---

## Notes

- This command is designed to be the **first thing a user runs** after installing V3 Daily Environment_User
- It should take less than 30 seconds to complete
- All connector tests use lightweight calls that consume minimal API quota
- The command can be re-run at any time to check system health
- Connector IDs are session-specific — they may change if the user reconnects or updates their MCP configuration
