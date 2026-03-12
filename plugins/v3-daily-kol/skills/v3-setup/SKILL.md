---
name: v3-setup
description: >
  V3 Daily KOL environment initialization. Auto-detects MCP connectors,
  creates workspace directories, seeds the knowledge base, writes connector
  IDs to CLAUDE.md, and reports ready state. Idempotent and safe to re-run.
  Trigger: user says "/setup", "setup", "initialize", "init environment",
  "check connectors", "verify setup", or "run setup".
---

# /setup — V3 Daily KOL Environment Initialization

First-run initialization command. Safe to re-run (idempotent, never overwrites existing data).

**Prerequisites**: MCP connectors should be installed first. See `config/mcp_setup_guide.md`.

**Full specification**: `commands/setup.md` contains the canonical spec. This skill implements it.

---

## Step 1: Auto-Detect and Verify MCP Connectors

Test each connector with a lightweight API call. Do NOT rely on hardcoded IDs.

### 1.1 Connector B — X Account Tools (REQUIRED)

Detect by finding the tool `get_user_info` in available MCP tools.

```
Test: get_user_info(userName: "ethereum")
Expected: Response with userName, followers, description fields
```

- If succeeds: Record UUID from tool namespace (`mcp__<UUID>__get_user_info` → save `<UUID>`). Report `✅ Connector B — connected`
- If fails: Report `❌ Connector B — NOT CONNECTED`. Direct to `config/mcp_setup_guide.md` Step 4.1.

### 1.2 Connector A — X Search API (CONDITIONAL)

Only required if Kaito is unavailable. Detect by finding `search_x`.

```
Test: search_x(query: "ethereum", sort: "impressions")
Expected: Tweet results
```

- If succeeds: Record UUID. Report `✅ Connector A — connected (last-resort fallback)`
- If fails: Report `⚠️ Connector A — not connected`. Fine if Kaito is connected.

**Note**: If one connector provides BOTH `get_user_info` AND `search_x`, it serves as both A and B.

### 1.3 Tavily — Web Research (REQUIRED)

Detect by finding `tavily_search`. If multiple instances exist, test each.

```
Test: tavily_search(query: "ethereum 2026")
Expected: Search results with URLs and snippets
```

- If multiple exist: Test each. Use first that responds. Mark broken ones.
- If succeeds: Report `✅ Tavily — connected`
- If all fail: Report `❌ Tavily — NOT CONNECTED`. Direct to `config/mcp_setup_guide.md` Step 4.3.

### 1.4 Kaito — Crypto Intelligence (RECOMMENDED)

Primary for Mode A keyword search. Detect by finding `kaito_mindshare`.

```
Test: kaito_mindshare(token: "ETH")
Expected: Mindshare data response
```

- If succeeds: Report `✅ Kaito AI — connected (primary for Mode A)`
- If fails: Report `⚠️ Kaito AI — not connected. Mode A uses fallback chain.`

### 1.5 Status Summary

Display this table with actual results:

```
┌─────────────────────────────────────────────────┐
│           V3 Daily KOL — Connector Status       │
├───────────────┬──────────┬──────────────────────┤
│ Connector     │ Status   │ Role                 │
├───────────────┼──────────┼──────────────────────┤
│ Connector B   │ ✅ / ❌   │ Tweet retrieval (REQUIRED)           │
│ Tavily        │ ✅ / ❌   │ Web research (REQUIRED)              │
│ Kaito         │ ✅ / ⚠️   │ Mode A primary + crypto (RECOMMENDED)│
│ Connector A   │ ✅ / ⚠️   │ Keyword search fallback (CONDITIONAL)│
└───────────────┴──────────┴──────────────────────┘
```

### 1.6 Gate Logic

Apply these rules strictly:

- **Connector B missing** → STOP. Cannot proceed.
- **Tavily missing** → STOP. Cannot proceed.
- **Both Kaito AND Connector A missing** → STOP. At least one keyword search source required.
- **Kaito missing, Connector A present** → WARN. Proceed (fallback mode).
- **Connector A missing, Kaito present** → OK. Proceed.

If any blocking condition is met: STOP. Show which connectors are missing. Direct user to `config/mcp_setup_guide.md`. Do not continue to Step 2.

### 1.7 Write Connector IDs to CLAUDE.md

After successful detection, update CLAUDE.md Section 2.1 connector table:

1. Read CLAUDE.md Section 2.1
2. For each successful connector, write its UUID (extracted from `mcp__<UUID>__tool_name`)
3. For failed connectors, mark as `—` with note
4. For broken instances (e.g., Tavily that 500s), add row: `**Tavily (broken)** | <UUID> | — | **DO NOT USE** — returns errors | —`
5. For Kaito if unavailable: ID = `—`, note "not connected — Mode A will use fallback chain"
6. Save CLAUDE.md

**On re-run**: Overwrite the ID column with fresh values (handles reconnected services).

---

## Step 2: Create Workspace Directories

Create these directories if they don't exist:

```bash
mkdir -p account_data/profile
mkdir -p account_data/data
mkdir -p account_data/knowledge
mkdir -p account_data/output
mkdir -p account_data/analytics
mkdir -p account_data/logs
mkdir -p account_data/weekly/knowledge_edit_proposals
mkdir -p account_data/weekly/effectiveness_reports
mkdir -p account_data/weekly/own_post_recs_archive
mkdir -p account_data/weekly/claude_md_proposals
```

If all directories already exist, report: "Workspace directories already exist — skipping."

---

## Step 3: Seed Knowledge Base

Copy `seeds/web3_knowledge_base_seed.md` → `account_data/knowledge/web3_knowledge_base.md`

**Rules:**
- If `account_data/knowledge/web3_knowledge_base.md` already exists → DO NOT overwrite. Report "Knowledge base already exists — skipping seed copy (existing KB preserved)."
- If seed file missing → Report error: "seeds/web3_knowledge_base_seed.md not found"
- If KB doesn't exist → Copy seed. Report "✅ Knowledge base seeded"

---

## Step 4: Report Ready State

Display final status box:

```
┌─────────────────────────────────────────────────┐
│         V3 Daily KOL — Environment Ready        │
├─────────────────────────────────────────────────┤
│                                                 │
│  Connectors:  {N}/2 required connected          │
│               Kaito: {status}                   │
│               Connector A: {status}             │
│                                                 │
│  Workspace:   Directories ready                 │
│  Knowledge:   {Seeded / Already exists}         │
│                                                 │
│  Next step:   Run /onboard @handle to set up    │
│               your first account                │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Readiness conditions:**
- B + Tavily + (Kaito OR A) → "✅ Environment is ready. Run `/onboard @handle` to onboard your first account."
- B or Tavily missing → "❌ Environment not ready — required connectors missing. See `config/mcp_setup_guide.md`."
- Both Kaito and A missing → "⚠️ No keyword search source. Install Kaito (recommended) or Connector A (fallback)."

---

## Error Handling

| Error | Action |
|-------|--------|
| Connector test times out | Retry once. If still fails, mark ❌ |
| Unexpected response format | Mark ⚠️ "connected but unexpected response — verify manually" |
| File system permission error | Report error with path |
| Seed file missing | Report error — project files may be incomplete |
| Multiple connectors provide same tool | Use first valid responder; note which was selected |
