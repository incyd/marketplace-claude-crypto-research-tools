# v3 Daily Environment_User System Instructions

> **This file is the single source of truth** read by ALL agents at session startup. It defines system-wide rules, agent roles, and common constraints. Do not duplicate these rules in agent configs — reference this file instead.
>
> **Ownership**: Sections 1-5 are immutable (set during setup). Section 6 is updated by Agent ① after onboarding. Section 7 is the learning log — Agent ④ proposes entries in weekly proposal docs; user reviews and applies approved entries.

---

## 1. SYSTEM OVERVIEW

- **Pipeline Model**: Sequential 4-agent workflow (① → ② → ③ → ④)
- **Architecture (v3.1)**: Isolated subagent execution — each agent (②③④) spawned via Cowork Agent tool with its own context window. Orchestrators coordinate sequencing and validation. File-based handoff, no shared memory between agents.
- **Cadence**: Onboarding (1x per account), Daily (Agents ② → ③ via orchestrator), Weekly (Agent ④ via orchestrator)
- **Environment**: Claude Cowork (Opus 4.6 for ①③④, Sonnet 4.6 for ②)
- **Reference docs**: `V3_ARCHITECTURE.md`, `templates/data_schema_map.md`

### 1.1 Agent Roles (do not modify)

| Agent | Model | Trigger | Purpose |
|-------|-------|---------|---------|
| **① Onboarding** | Opus 4.6 | Manual (1x per account) | Extract topics, voice, competitors, CTAs from Environment_User's post history |
| **② Daily Pull** | Sonnet 4.6 | Daily (scheduled) | Fetch posts from X in 3 modes, normalize to canonical schema, append to data files |
| **③ Analytics & Content** | Opus 4.6 | Daily (chained after ②) | Analyze daily posts, generate engagement replies + own-post recommendations |
| **④ Weekly Learning** | Opus 4.6 | Weekly (scheduled, Sunday) | Analyze 7-day data, propose KB edits, propose CLAUDE.md learning log updates (all outputs are proposals for user review) |

### 1.2 Pipeline Flow (v3.1 — Isolated Subagents)

```
User provides @handle + CTAs
        ↓
① Onboard → account_profile.md (one-time, direct execution)
        ↓
Daily Orchestrator (scheduled task)
  ├─ Read CLAUDE.md + pre-flight checks
  ├─ Spawn Agent ② subagent (Sonnet, own context window)
  │     └─ → daily_posts.json + own_posts.jsonl
  ├─ Validate Agent ② output (today's date key exists, ≥1 theme)
  ├─ Spawn Agent ③ subagent (Opus, own context window)
  │     └─ → engagement_replies.xlsx + own_post_recs.xlsx + analytics_history.jsonl
  └─ Validate Agent ③ output + write orchestrator log

Weekly Orchestrator (scheduled task)
  ├─ Read CLAUDE.md + pre-flight checks (≥1 day analytics)
  ├─ Spawn Agent ④ subagent (Opus, own context window)
  │     └─ → KB edit proposals + effectiveness report + CLAUDE.md learning log proposals
  └─ Validate Agent ④ output + write orchestrator log
```

### 1.3 Ad-Hoc Request Handling

Ad-hoc requests (reply to a tweet, draft a post, respond to an article) route through Agent ③ logic in **read-only mode**:
- Load account profile + web3 knowledge base
- Generate content using the full ③ pipeline including humanizer
- Output goes directly to user — **NEVER to data files**
- Data files (`daily_posts.json`, `own_posts.jsonl`, `analytics_history.jsonl`) remain clean records of scheduled pipeline runs only

### 1.4 Context Manifest — What Each Agent Reads at Startup

> **This is the authoritative list of files each agent must load.** Agent configs contain a "Step 0: Load Context" section that mirrors this table. If there is ever a conflict, this CLAUDE.md table wins.
>
> **v3.1 Note**: Agents ②③④ read their configs from `agents/` (primary runtime source). Agent ① reads from `config/agent_onboarding.md` (not a subagent). The `config/agent_*.md` files for ②③④ are archive copies only.
>
> **Categories**: ESSENTIAL = agent will not function without it. REFERENCE = consult specific sections as needed during execution. DATA = runtime data files consumed during processing. OPTIONAL = enhances quality but agent can proceed without it.

#### ALL Agents — Universal Context (read first, in this order)

| # | File | Sections to Read | Category | Why |
|---|------|-----------------|----------|-----|
| 1 | `CLAUDE.md` | **Full file** (Sections 1-7) | ESSENTIAL | System rules, connector IDs, tool matrix, rate limits, file ownership, append-only protections |
| 2 | Agent config (see below) | **Full file** | ESSENTIAL | Agent-specific task instructions, step-by-step process, validation gates, failure modes |
| 3 | `config/mcp_setup_guide.md` | Section 5 (Tool Reference), Section 6 (Decision Tree), Section 7 (Troubleshooting) | REFERENCE | Tool behavior, which connector to use for what, known issues |

> **Agent config locations**: Agent ① = `config/agent_onboarding.md` | Agent ② = `agents/agent-daily-pull.md` | Agent ③ = `agents/agent-analytics.md` | Agent ④ = `agents/agent-weekly-learning.md`

#### Agent ① — Onboarding

| # | File | Sections to Read | Category | Why |
|---|------|-----------------|----------|-----|
| 4 | `templates/account_profile_template.md` | **Full file** | ESSENTIAL | Output template — Agent ① must produce a profile that conforms to this structure |
| 5 | `templates/data_schema_map.md` | Section 3 (Canonical Post Schema), Section 3.1 (Normalization) | REFERENCE | Post schema for corpus normalization during 200-post pull |
| 6 | `seeds/web3_knowledge_base_seed.md` | **Full file** (or `account_data/knowledge/web3_knowledge_base.md` if it exists) | REFERENCE | Understand existing web3 context to avoid duplicating known narratives in topic extraction |

#### Agent ② — Daily Pull

| # | File | Sections to Read | Category | Why |
|---|------|-----------------|----------|-----|
| 4 | `account_data/profile/account_profile.md` | Topics + keyword combos, thought-leader list, Environment_User handle | ESSENTIAL | Drives all 3 pull modes — keyword combos (Mode A), TL accounts (Mode B), own handle (Mode C) |
| 5 | `templates/data_schema_map.md` | Section 3 (Canonical Post Schema), Section 3.1 (Normalization), Section 4.1 (`daily_posts.json` structure), Section 4.2 (`own_posts.jsonl` structure) | ESSENTIAL | Every write must conform to these schemas |
| 6 | `account_data/data/daily_posts.json` | Last date key only (to check for existing today entry) | DATA | Dedup check — don't re-pull if today's data already exists |
| 7 | `account_data/data/own_posts.jsonl` | Last 10 lines (recent post_ids) | DATA | Dedup by post_id before appending |

#### Agent ③ — Analytics & Content

| # | File | Sections to Read | Category | Why |
|---|------|-----------------|----------|-----|
| 4 | `account_data/profile/account_profile.md` | Voice guide, CTAs, topics, competitor context | ESSENTIAL | Voice matching, CTA insertion rules, topic expertise for angle identification |
| 5 | `account_data/data/daily_posts.json` | Today's date key only | ESSENTIAL | The posts to analyze and generate engagement replies for |
| 6 | `account_data/data/own_posts.jsonl` | Last 7 days | ESSENTIAL | What Environment_User has already posted — avoid recommending angles they've covered, maintain narrative continuity |
| 7 | `account_data/knowledge/web3_knowledge_base.md` | **Full file** | ESSENTIAL | Web3 context for informed engagement — narratives, terminology, protocol details |
| 8 | `templates/data_schema_map.md` | Section 4.3 (`analytics_history.jsonl` structure), Section 4.4 (`engagement_replies.xlsx` columns) | REFERENCE | Output schema for analytics record and spreadsheet |
| 9 | `account_data/analytics/analytics_history.jsonl` | Last 3 days (trend context) | OPTIONAL | Recent analytics for consistency — what angles worked recently |

#### Agent ④ — Weekly Learning

| # | File | Sections to Read | Category | Why |
|---|------|-----------------|----------|-----|
| 4 | `account_data/profile/account_profile.md` | Topics, keyword combos, competitor list | ESSENTIAL | Baseline for measuring drift — are topics still relevant? Are keyword combos still producing signal? |
| 5 | `account_data/analytics/analytics_history.jsonl` | Last 7 days | ESSENTIAL | Primary input — what the system recommended and how it performed |
| 6 | `account_data/data/own_posts.jsonl` | Last 7 days | ESSENTIAL | What the Environment_User actually posted — for proposed-vs-actual comparison |
| 7 | `account_data/output/own_post_recs.xlsx` | Current file + archived versions from `weekly/own_post_recs_archive/` | ESSENTIAL | The specific recommendations to compare against actual posts |
| 7b | `account_data/output/engagement_replies.xlsx` | Last 7 days of rows (columns 19-20: Post ID, Angle Source Mix) | ESSENTIAL | Reply adoption tracking — match Post ID against `own_posts.jsonl.in_reply_to_id` |
| 8 | `account_data/knowledge/web3_knowledge_base.md` | **Full file** | ESSENTIAL | Must read current state to propose meaningful additions/updates/removals |
| 9 | `account_data/data/daily_posts.json` | Last 7 date keys | OPTIONAL | Full post data for deeper trend analysis (convergence themes, signal patterns) |
| 10 | `templates/data_schema_map.md` | Section 4.3, 4.4 (`analytics_history.jsonl` + `engagement_replies.xlsx` structure) | REFERENCE | Validate data integrity of analytics records and reply schema |
| 11 | `account_data/logs/agent_2_log.txt` | **Full file** (this week's entries) | ESSENTIAL | Agent ② operational logs — pull success/failures, connector issues, dedup stats |
| 12 | `account_data/logs/agent_3_log.txt` | **Full file** (this week's entries) | ESSENTIAL | Agent ③ operational logs — theme counts, reply stats, Tavily usage, humanizer flags |

#### Ad-Hoc Requests (Agent ③ in read-only mode)

| # | File | Sections to Read | Category | Why |
|---|------|-----------------|----------|-----|
| 1 | `CLAUDE.md` | Sections 1-2 (system rules, tool rules) | ESSENTIAL | System constraints |
| 2 | `account_data/profile/account_profile.md` | Voice guide, CTAs, topics | ESSENTIAL | Voice matching and CTA rules |
| 3 | `account_data/knowledge/web3_knowledge_base.md` | **Full file** | ESSENTIAL | Web3 context for informed content |
| 4 | `account_data/data/own_posts.jsonl` | Last 7 days | OPTIONAL | Recent posting context for consistency |

> **Files agents must NEVER read**: `V3_ARCHITECTURE.md` and `Claude Code output/*` are design-time reference docs for the human builder. They are NOT runtime context for agents. Agents should never load these files — all operational rules are in `CLAUDE.md`, `agents/agent-*.md`, and `templates/`.

### 1.5 Orchestrator Design (v3.1)

**Why subagents**: In v3.0, Agent ② and Agent ③ ran in a single session sharing one context window. Agent ② consumed ~60% of context, leaving Agent ③ with degraded performance (confidence dropped 7.5→6.9, generic themes, convergence misapplied). In v3.1, each agent runs as an isolated subagent with its own full context window.

**How it works**:
1. Scheduled tasks run orchestrator prompts (from `orchestrators/daily-pipeline.md` and `orchestrators/weekly-learning.md`)
2. Orchestrators read `CLAUDE.md` for system context, then read agent configs from `agents/`
3. Orchestrators spawn agents via the Cowork Agent tool: `Agent(subagent_type: "general-purpose", model: "<model>", prompt: <full agent config>)`
4. Each subagent gets its own context window — no cross-contamination between agents
5. Orchestrators validate output between agents (gated execution) and log results

**Model assignments**:
- Agent ② (Daily Pull): Sonnet 4.6 — optimized for structured data retrieval
- Agent ③ (Analytics & Content): Opus 4.6 — requires nuanced voice matching and creative content
- Agent ④ (Weekly Learning): Opus 4.6 — requires deep trend analysis and strategic recommendations

**Validation gates** (orchestrator checks between agents):
- Orchestrator → Agent ②: pre-flight checks pass (profile exists, data files initialized)
- Agent ② → Orchestrator: `daily_posts.json` has today's date key with ≥1 theme and fresh pull_timestamp
- Orchestrator → Agent ③: freshness check on `daily_posts.json` (today's entry verified)
- Agent ③ → Orchestrator: `engagement_replies.xlsx` updated + `analytics_history.jsonl` has today's entry
- Orchestrator → Agent ④: ≥1 day of analytics data in last 7 days
- Agent ④ → Orchestrator: weekly report file exists in `account_data/weekly/`

**Error handling**: If Agent ② fails, Agent ③ does NOT run. Failures are logged but never retried in the same run.

**Directory layout**:
- `agents/` — PRIMARY runtime source for agent configs (Agents ②③④)
- `orchestrators/` — orchestrator templates (become scheduled task prompts)
- `config/` — ARCHIVE of v3.0 agent configs + non-agent configs (mcp_setup_guide, alignment_check_protocol, agent_onboarding)

---

## 2. MCP TOOL RULES (CRITICAL)

### 2.1 Connector Allocation & Cost Control

Connector IDs are environment-specific — each Cowork installation assigns its own internal IDs. The `/setup` command auto-detects connectors by testing tool availability and writes the discovered IDs into this table. For new installations, see `config/mcp_setup_guide.md` for how to install connectors and obtain API keys.

> **How this table gets populated**: On a fresh install, the ID column is empty. When `/setup` runs, it detects each connector by testing tool availability and writes the discovered IDs here. Agents then read this table to know which MCP prefix to use. If connectors change (reconnected, updated), re-run `/setup` to refresh the IDs.

| Connector | ID | Detected By | Role | Cost |
|-----------|-----|-------------|------|------|
| **Connector B** | `32493dcb` | Provides `get_user_info` | ALL tweet retrieval — timelines, user info, threads, replies | Standard |
| **Connector A** | `3441bdf2` | Provides `search_x` | **LAST RESORT** — keyword search via `search_x` (fallback only after Kaito+B exhausted) | Expensive — **fallback only** |
| **Tavily** | `f5b10baf` | Provides `tavily_search` | Web3 research — enrichment, validation, fact-checking | Standard |
| **Tavily (broken)** | `a0103b84` | — | **DO NOT USE** — returns 500 errors in this environment | — |
| **Kaito** | `Kaito_AI` | Provides `kaito_mindshare` | **Primary keyword search (Mode A)** via `kaito_advanced_search` + secondary: mindshare, sentiment, smart engagement | Premium (80 req/day max; Mode A uses ~6-10/day) |

**Hard rules:**
- Connector A `get_tweet` → **NEVER USE**. All individual tweet fetching goes through Connector B.
- Connector A `get_profile` → **NEVER USE** (known to error on many providers). Use Connector B `get_user_info`.
- Connector A `get_thread` → **NEVER USE** (known to error on many providers). Use Connector B `get_tweet_thread`.
- If multiple Tavily instances exist, use whichever one responds successfully to a test call. Mark non-responsive instances in this table.
- Kaito `kaito_advanced_search` → **PRIMARY for Mode A keyword search**. Always use parameters: `author_type: "Individual"`, `sort_by: "engagement"`, `sources: "Twitter"`, `min_created_at`: 24h window, `size: 20`. Extract tweet IDs from result URLs, fetch full copy via Connector B `get_tweet_thread`.
- Kaito → Check availability at runtime. Track cumulative daily call count. Stop at 80.

### 2.2 Agent-Specific Tool Matrix

**Agent ① (Onboarding):**
- Connector B: `search_tweets` (200-post onboarding pull via `from:{handle}` + date windowing), `get_user_info`, `get_user_followers`, `get_user_following`, `search_users`
- Connector A: `search_x` (keyword combo validation only)
- Tavily: `tavily_search`, `tavily_research` (topic enrichment)
- Kaito (optional): `kaito_advanced_search` (narrative setup)
- Skills: `brand-voice-extractor`, `web3-research`, `competitive-analysis`, `x-research`

**Agent ② (Daily Pull):**
- Kaito: `kaito_advanced_search` (Mode A topics — primary, ~6-10 calls/day)
- Connector B: `get_tweet_thread` (fetch full tweets from Kaito URLs), `get_user_tweets` (Mode B TLs + Mode C own posts), `search_tweets` (Mode A fallback 1), `get_user_info` (author enrichment — only if Connector A fallback activated)
- Connector A: `search_x` (Mode A **last-resort fallback** — only if both Kaito and Connector B `search_tweets` fail)
- **NO Tavily** (pure data fetch, no research)
- Skills: `x-research`, `x-mastery` (signal scoring weights)

**Agent ③ (Analytics & Content):**
- Tavily: `tavily_search`, `tavily_research` (ad-hoc context enrichment)
- Kaito (optional): `kaito_engagement` (smart engagement signal for post selection)
- **NO Connector A, NO Connector B** (reads data files only — no direct X API calls)
- Skills: `humanizer` (mandatory final step), `brand-voice-extractor` (voice reference), `twitter-algorithm-optimizer`, `x-mastery`, `marketing:content-creation`, `xlsx`

**Agent ④ (Weekly Learning):**
- Tavily: `tavily_search`, `tavily_research` (trend validation, emerging narrative research)
- Kaito (optional): `kaito_mindshare`, `kaito_sentiment` (weekly trend analysis)
- **NO Connector A, NO Connector B** (reads data files only)
- Skills: `web3-research`, `competitive-analysis`, `validator-role-skill`, `design-serialization-schema`

### 2.3 Rate Limits

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Kaito `kaito_advanced_search` | Mode A uses ~6-10 calls/day (of 80/day shared budget) | Agent ② tracks cumulative daily Kaito usage. Before each call, verify total < 80. If budget exhausted, switch to Connector B `search_tweets` fallback. See `agents/agent-daily-pull.md` Section 1.3. |
| Connector A `search_x` | Max 10 calls/day (**fallback only** — primary keyword search now via Kaito) | Agent ② config tracks call count. **⚠️ LAST RESORT**: Only activated if both Kaito and Connector B `search_tweets` fail. Pay-per-use credits (402 CreditsDepleted). See `agents/agent-daily-pull.md` Section 1.3.2. |
| Connector B `get_user_tweets` | Max 20 tweets per call (originals + quote tweets; no replies, no pure RTs). **Mode B budget: 1 call per TL (dynamically computed), up to 5 posts per TL after filtering. TLs processed in batches of 5 — batch count = `ceil(TL_count / 5)`.** Mode C: 1 call. | Used by Agent ② for daily TL/own pulls. NOT for onboarding — use `search_tweets` instead. Pagination has ~75% overlap between pages — dedup by tweet ID |
| Connector B `search_tweets` | Max 20 tweets per call (all types incl. replies) | Used by Agent ① for 200-post onboarding pull (budget: 20 calls). Also used by Agent ② as **Mode A fallback 1** if Kaito unavailable (budget: 10-call cap shared with primary). |
| Kaito (all tools) | Max 80 calls/day across ALL agents | Runtime check before each call |
| Tavily | Generous (1000+/day); **Agent ③ max 10 calls per run** | Agent ③ config tracks per-run count. If budget exhausted mid-run, skip remaining enrichment. |
| Typefully | ~19 draft creations per burst; 429 persists for hours | Agent ③ pushes drafts sorted by confidence (highest first). On 429 error, save remaining to `unpushed_typefully_drafts.json` and wait 4 hours before retrying. See `agents/agent-analytics.md` Section 7.1. |

---

## 3. FILE OWNERSHIP & HANDOFF CONTRACTS

### 3.1 File Ownership Matrix

| File | Owner (Writer) | Mode | Readers |
|------|---------------|------|---------|
| `account_data/profile/account_profile.md` | Agent ① | Create (1x) | ②③④, User |
| `account_data/data/daily_posts.json` | Agent ② | **Append-only** (daily, by date key) | ③④ |
| `account_data/data/own_posts.jsonl` | Agent ② | **Append-only** (daily, dedup by post_id) | ③④ |
| `account_data/analytics/analytics_history.jsonl` | Agent ③ | **Append-only** (daily, 1 record/day) | ④ |
| `account_data/output/engagement_replies.xlsx` | Agent ③ | **Append-only** (new rows daily) | User |
| `account_data/output/own_post_recs.xlsx` | Agent ③ | **Append-only** (new rows daily; archived first) | ④, User |
| `account_data/weekly/` | Agent ④ | Write (weekly reports + KB proposals) | User |
| `account_data/knowledge/web3_knowledge_base.md` | Agent ④ | **Append-only** (weekly, user-approved) | ①②③ |
| `CLAUDE.md` | Agent ④ | **Propose-only** (Section 7 changes written to weekly proposal doc; user applies after review) | ①②③ |

### 3.2 Handoff Contracts (v3.1 — Orchestrator-Gated)

> **v3.1 change**: Handoffs between agents ②→③ are now validated by the orchestrator, not by the receiving agent. The orchestrator reads output files, checks freshness/completeness, and only spawns the next agent if validation passes. Agent-internal validation still applies (defense in depth).

**Agent ① → Agent ②:**
- **Delivers**: `account_profile.md` (topics with keyword combos, thought-leader list, CTAs)
- **Orchestrator validates (pre-flight)**: Profile exists AND is non-empty
- **Agent ② validates (internal)**: Profile has non-empty `keyword_combos` and `thought_leaders` sections
- **If missing/corrupt**: Orchestrator aborts pipeline — Agent ② never spawns

**Agent ② → Orchestrator → Agent ③:**
- **Delivers**: `daily_posts.json` (today's date key with themes + posts), `own_posts.jsonl` (full history)
- **Orchestrator validates**: Today's date key exists in `daily_posts.json` with `pull_timestamp` < 2h old AND at least 1 theme with posts
- **Agent ③ validates (internal)**: Today's date key exists with pull timestamp < 24h old AND at least 1 theme
- **If orchestrator validation fails**: Agent ③ never spawns. Orchestrator logs error and stops.

**Agent ③ → Agent ④ (weekly, via weekly orchestrator):**
- **Delivers**: `analytics_history.jsonl` (7-day window), `own_posts.jsonl` (7-day window), `own_post_recs.xlsx` (current), `engagement_replies.xlsx` (7-day window)
- **Also reads**: `agent_2_log.txt` and `agent_3_log.txt` (Agent ② and ③ operational logs for the week)
- **Orchestrator validates (pre-flight)**: At least 1 day of analytics data in last 7 days
- **Agent ④ validates (internal)**: Each JSONL line is valid JSON with required fields
- **If insufficient**: Orchestrator skips weekly learning with warning "Insufficient data"

### 3.3 own_post_recs Archive Rule

Before Agent ③ appends new rows to `own_post_recs.xlsx`:
1. Copy current file to `weekly/own_post_recs_archive/YYYY-MM-DD_recs.xlsx`
2. Then append new rows (do NOT overwrite existing rows)
3. Agent ④ reads archived versions for proposed-vs-actual comparison

---

## 4. DATA SCHEMAS & VALIDATION RULES

### 4.1 Canonical Post Schema

Every post in `daily_posts.json` and `own_posts.jsonl` MUST conform to the canonical schema defined in `templates/data_schema_map.md` Section 3.

**Required fields**: `post_id`, `text`, `author_handle`, `author_followers`, `views`, `likes`, `replies`, `retweets`, `quotes`, `bookmarks`, `created_at`, `url`, `source_connector`, `pull_date`

**Validation rules:**
- `source_connector` MUST be `"A"`, `"B"`, or `"Kaito+B"` (enum — `"Kaito+B"` = Kaito discovery + Connector B full tweet fetch; `"A"` = Connector A fallback; `"B"` = Connector B search_tweets fallback or Mode B/C)
- `created_at` MUST be ISO 8601 format (`YYYY-MM-DDTHH:MM:SSZ`)
- `pull_date` MUST be `YYYY-MM-DD`
- `post_id` MUST be unique within each file (dedup key)

### 4.2 Signal Scoring Formula

> **Canonical definition**: `templates/data_schema_map.md` Section 8. This section is a summary — if there is ever a conflict, data_schema_map.md Section 8 wins.

```
engagement_score = (replies × 27) + (retweets × 20) + (quotes × 24) + (likes × 1) + (bookmarks × 4)

signal_score = engagement_score / max(views, 1) × 1000

// Modifiers:
// +1.0 if author_verified = true
// +0.5 if author_followers > 10000
// +2.0 if convergence_flag = true
// Cap at 10.0
```

Weights derived from X algorithm open-source analysis (`x-mastery` skill): replies are 27x more valuable than likes because they trigger algorithmic distribution. The views-based normalization ensures high-engagement-per-impression posts rank above raw-volume posts.

### 4.3 Narrative Stage Definitions

> **Canonical definitions** — all agents and the web3 knowledge base MUST use these stage labels. Agent ④ classifies narratives into these stages during weekly analysis. Do NOT invent new stage labels.

| Stage | Label | Criteria | KB Section |
|-------|-------|----------|-----------|
| 1 | **EMERGING** | First 1-2 days of signal, < 3 unique sources, no Tavily validation yet | Section 3 (On the Rise) |
| 2 | **ACCELERATING** | 3-5 days of signal OR Tavily-validated with growing mindshare, multiple institutional actors | Section 3 → moving to Section 1 |
| 3 | **ESTABLISHED** | 7+ days sustained signal, institutional adoption confirmed, protocol integrations live | Section 1 (Active Narratives) |
| 4 | **MATURE** | Stable signal but no longer growing, part of market infrastructure (e.g., tokenized treasuries) | Section 1 (marked "mature") |
| 5 | **DECLINING** | Signal ratio dropping below 0.4, mindshare falling, fewer new developments | Section 1 → Section 2 (Fading) |
| 6 | **FADING** | Minimal signal, hype cycle exhausted, no new capital flows | Section 2 (Fading Narratives) |
| 7 | **DEAD** | Zero signal for 14+ days, narrative fully absorbed or abandoned | Remove from KB (archive in learning log) |

**Stage transition rules:**
- Narratives can only move ONE stage at a time per weekly review (no jumping from EMERGING → ESTABLISHED)
- Exception: if Tavily + Kaito data overwhelmingly supports skipping a stage, Agent ④ can propose a 2-stage jump with explicit justification
- Downward transitions require 2 consecutive weeks of declining signal before moving to FADING
- DEAD requires user approval before removal from KB

### 4.4 Theme Clustering Rules

- Posts grouped by theme after signal filtering
- Theme labels are human-readable (e.g., "ETH restaking yield")
- Each theme MUST have 2+ posts to qualify
- **Mode A (topics)**: Top 7 themes, up to 5 posts each
- **Mode B (thought leaders)**: Batched processing — TLs split into batches of 5 (batch count = `ceil(TL_count / 5)`, computed dynamically). Each batch clusters up to 4 themes with max 3 posts each. After all batches, a merge step deduplicates cross-batch themes and selects top 10 final themes (max 30 posts total). See `agents/agent-daily-pull.md` Sections 2.3–2.5.
- **Convergence flag**: `true` if a theme appears in BOTH Mode A and Mode B with 3+ unique authors
- **Convergence validation gate**: If >50% of themes are flagged convergent, re-run with stricter matching (2+ shared keyword combos OR 3+ shared author handles). Log convergence ratio in completion report. See `agent_daily_pull.md` Section 2.8 for full algorithm.
- **Theme label specificity**: Labels MUST reference a specific protocol/project, measurable event, or named narrative. BANNED: generic labels like "Crypto general", "Market sentiment", "DeFi ecosystem". See `agent_daily_pull.md` Section 1.7 step 2.
- **Tangential theme cap**: Themes with topic relevance 4-6 are capped at max 2 replies each. See `agent_analytics.md` Section 1.2.

### 4.5 Agent ③ Output Rules

- **MINIMUM OUTPUT TARGET**: 20 replies per daily run. Agent ③ generates a reply for EVERY post in a qualifying theme (only valid skip: exact duplicate angle or identical take in last 48h).
- **HARD CAP**: 500 characters maximum per reply. No exceptions.
- **ZERO TOLERANCE — Em dashes ("—")**: Replace every em dash with a comma, period, or line break. Em dashes are the #1 AI writing tell. No em dashes in any output, ever.
- **ANGLE DISTRIBUTION TARGET**: 70% cross-pollinated, 20% own-perspective, 10% research-informed. Cross-pollination is the system's core value — take insights from one creator/project and apply them strategically when replying to another.
- **ANGLE DISTRIBUTION TRACKING**: `analytics_history.jsonl` MUST include `angle_distribution` object with counts and percentages for each angle type. See `data_schema_map.md` Section 4.3.
- **TYPEFULLY CONFIDENCE FLOOR**: Only push replies with confidence ≥ 6 to Typefully. Replies below floor remain in `engagement_replies.xlsx` for manual review. See `agent_analytics.md` Section 7.1 step 2.
- **COLUMN COUNT**: engagement_replies.xlsx has 20 columns (Column 19: Post ID, Column 20: Angle Source Mix). See `data_schema_map.md` Section 4.4.

### 4.6 Keyword Health Rules

- **Keyword probation**: New keywords are tagged `(NEW)` for first 3 days. Their signal ratio does NOT count toward overall keyword health until day 4. See `agents/agent-weekly-learning.md` Section 4.4.1.
- **Dormant keywords**: Keywords returning 0 results for 3 consecutive days are marked DORMANT and skipped during Mode A pre-flight. Agent ④ reviews at next weekly cycle.

---

## 5. APPEND-ONLY FILE PROTECTIONS

### 5.1 Protected Files (NEVER overwrite or delete existing content)

1. **`daily_posts.json`** — Append new date keys only. Never modify/delete historical entries.
2. **`own_posts.jsonl`** — Append new lines only. Dedup by `post_id`. Never rewrite.
3. **`analytics_history.jsonl`** — Append new daily records only. Never modify past records.
4. **`web3_knowledge_base.md`** — Agent ④ proposes additions/updates/removals; user approves. Never auto-delete content.
5. **`CLAUDE.md`** — Agent ④ proposes Section 7 updates in weekly proposal doc (`weekly/claude_md_proposals/YYYY-WNN_learning_log.md`). User reviews and applies approved entries. Agent ④ does NOT write to CLAUDE.md directly. Sections 1-6 are immutable after setup.

### 5.2 Files That May Be Overwritten

1. **`own_post_recs.xlsx`** — Append-only daily by Agent ③ (archived first — see Section 3.3)
2. **`engagement_replies.xlsx`** — New rows appended daily (old rows preserved)
3. **Weekly reports** — New file per week (`YYYY-WNN_*.md`)

### 5.3 Hookify Rules (to be installed during Phase 5b — Hardening)

| Rule | Protects | Allows |
|------|----------|--------|
| `protect-append-only-data` | `daily_posts.json`, `own_posts.jsonl`, `analytics_history.jsonl` | Owner agent appending only |
| `protect-claude-md-structure` | CLAUDE.md Sections 1-6 | User-applied entries to Section 7 (Agent ④ proposes only, never writes directly) |
| `enforce-file-ownership` | All data files | Only designated owner can write |
| `prevent-parallel-writes` | All append-only files | One agent writing at a time |
| `validate-schema-before-write` | `daily_posts.json`, `own_posts.jsonl` | Write only if canonical schema validates |

---

## 6. ACTIVE ACCOUNTS

| Handle | Onboarded | Topics | Competitors | TLs Tracked | Status |
|--------|-----------|--------|-------------|-------------|--------|
| @incyd__ | 2026-03-03 | 4 (DeFi Yields, AI+Claude Tooling, RWA+Gold, DeFi Risk) | 5 | 23 | Active — daily pipeline running |

---

## 7. Agent ④ Learning Log

> Agent ④ proposes weekly entries via `weekly/claude_md_proposals/YYYY-WNN_learning_log.md`. User reviews proposals and applies approved entries below. Each entry is date-stamped. Newer entries go at the bottom. Never delete or modify existing entries.

### Week of 2026-03-04 — 2026-03-06

**Keyword performance:**
- `defi yields` and `vault strategy` proven 100% reliable across all 3 days — maintain as top-priority keywords
- `morpho lending` showing perfect signal ratio (2/2 days) — newly reliable, monitor for confirmation next week
- Eight keyword combos returned zero signal (yield tranching, gold onchain, rwa yield, mcp crypto, tokenized gold vault, etc.) — recommend quarterly refresh with Mode B organic discovery
- `ai defi` and `claude agent crypto` volatile (50% ratio) — context-dependent, appear during specific thought-leader announcements
- **Recommendation**: Introduce "morpho infrastructure," "gold tokenization defi," "vault risk transparency," "ai yield context" as replacements for dead combos

**Narrative shifts:**
- Morpho institutional adoption: Three consecutive days (03-04→06), signal strength 10.0 across all appearances. Tavily confirms: Steakhouse $1.45B+ deposits (+600% YoY), Apollo 90M token acquisition, Coinbase $960M integration. Moving from emerging to established.
- Tokenized equities in DeFi composability: Appeared 03-05, 03-06 with 10.0 signal. Tavily validates $966M market, Ondo + Morpho integration active, Gauntlet risk-curation live. New sub-narrative within RWA.
- AI yield optimizer context gap: High-quality emerging insight (03-05). Identified specific market need (real-time risk intelligence) rather than product narrative. Opportunity for contrarian positioning.
- All other narratives transient (1-day only) — Morpho and tokenized equities moving toward established status

**Voice & content:**
- Angle distribution: Own-perspective overweight (41% vs 30% target), cross-pollinated underweight (15% vs 30% target). Agent ③ should increase Mode A + Mode B convergence weighting. Expected impact: +15% cross-pollinated angles.
- Confidence score healthy (7.5 avg, >7.0 target) — voice constraints being respected (zero humanizer flags, zero em dashes)
- Reply volume ramping (Day 1: 7, Day 2: 15, Day 3: 23) — indicates improving daily theme detection

**System:**
- First 3-day period shows solid baseline (3/7 days complete). Only 1 user post in analysis window (insufficient for adoption rate assessment). Cannot yet measure recommendation adoption — recommend reassessment once posting volume normalizes (20+ posts/week).
- Tavily research used strategically (3 searches for narrative validation, 16 total used across daily runs). Budget efficient.
- Data quality: All analytics records well-formed, all post data properly schema-compliant, no corruption detected

**Convergence:**
- Four themes showed convergence across Mode A (topics) and Mode B (thought-leaders): DeFi lending & yield protocols, DeFi yield optimization, AI agents & crypto tooling, Blockchain/Leverage/Market narratives
- Convergence appears at 8.0+ signal strength consistently — indicates these are genuine market consensus narratives, not niche topics
- Recommendation: Weight convergent themes 2x during engagement reply generation (prioritize cross-topic, cross-TL content)

**Keyword recommendations:**
- IMPLEMENTED (2026-03-09): "tokenized gold vault" → split into "tokenized gold" + "gold vault" (per user preference)
- IMPLEMENTED (2026-03-09): "rwa yield" → replaced with "rwa collateral" super-keyword (captures RWA-as-DeFi-collateral convergence)
- IMPLEMENTED (2026-03-09): "mcp crypto" → replaced with "ai yield optimization" (captures AI x yield intersection)
- IMPLEMENTED (2026-03-09): Added "morpho infrastructure" (organic discovery via Mode B)
- IMPLEMENTED (2026-03-09): Added "vault risk transparency" (high engagement on risk-focused content)
- MONITOR: "ai defi" (50% signal, context-dependent — kept but flagged for review)
