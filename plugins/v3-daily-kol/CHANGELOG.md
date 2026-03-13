# Changelog

---

## v3.1.1 — Agent 2 Batched TL Processing

**Problem:** Agent 2 was hitting context window limits processing 23 thought leaders in a single pass — ~330k chars of raw tweet data loaded simultaneously with no recovery path.

**Fix:** Batched processing. TLs are split into groups of 5, each batch is clustered independently, raw tweet data is discarded between batches, and themes are merged across all batches at the end.

**What this solved:**

1. Peak context usage dropped ~65% — from ~420k chars to ~145k per run
2. Theme quality improved — clustering 5 TLs produces tighter, more specific groupings than clustering 23 at once
3. Pipeline scales automatically — add more TLs and batch count adjusts via `ceil(TL_count / 5)`, no config changes needed

**Files changed:** `agents/agent-daily-pull.md`, `CLAUDE.md`

---

## v3.1 — Isolated Subagent Architecture

## The Problem

In v3.0, Agent 2 (Daily Pull) and Agent 3 (Analytics & Content) ran sequentially inside a single Cowork session, sharing one context window. Agent 2 consumed ~60% of available context loading posts, themes, and MCP tool responses. By the time Agent 3 started, it was working with ~40% of its ideal context capacity.

The result: Agent 3's output quality degraded over time. Confidence scores dropped from 7.5 to 6.9, theme labels became generic ("DeFi ecosystem" instead of "Morpho lending vault integration"), convergence flags were misapplied, and cross-pollinated angles decreased from 30% target to 15%.

## The Fix

V3.1 migrates to **isolated subagent execution**. Each agent now runs in its own context window via the Cowork Agent tool, with lightweight orchestrators coordinating the pipeline.

### Before (v3.0)
```
Scheduled Task (single session)
  └─ Agent 2 runs... uses 60% context
  └─ Agent 3 runs... has 40% context left → degraded output
```

### After (v3.1)
```
Daily Orchestrator (lightweight coordinator)
  ├─ Spawn Agent 2 subagent → own 100% context window (Sonnet)
  ├─ Validate Agent 2 output (check files, freshness)
  ├─ Spawn Agent 3 subagent → own 100% context window (Opus)
  └─ Validate Agent 3 output + write log
```

## What Changed

### New Directories

| Directory | Purpose |
|-----------|---------|
| `agents/` | **Primary** runtime agent configs for Agents 2, 3, 4. Each file is the full agent instruction set with a v3.1 subagent header. |
| `orchestrators/` | Orchestrator templates that become scheduled task prompts. Define spawn logic, validation gates, and error handling. |

### New Files

- `agents/agent-daily-pull.md` — Agent 2 config (816 lines, Sonnet)
- `agents/agent-analytics.md` — Agent 3 config (543 lines, Opus)
- `agents/agent-weekly-learning.md` — Agent 4 config (829 lines, Opus)
- `orchestrators/daily-pipeline.md` — Spawns Agent 2 → validates → spawns Agent 3
- `orchestrators/weekly-learning.md` — Spawns Agent 4

### What Moved

| Before (v3.0) | After (v3.1) | Status |
|----------------|-------------|--------|
| `config/agent_daily_pull.md` | `agents/agent-daily-pull.md` | config/ copy is now ARCHIVE |
| `config/agent_analytics.md` | `agents/agent-analytics.md` | config/ copy is now ARCHIVE |
| `config/agent_weekly_learning.md` | `agents/agent-weekly-learning.md` | config/ copy is now ARCHIVE |
| `config/agent_onboarding.md` | `config/agent_onboarding.md` | **Unchanged** (Agent 1 is not a subagent) |

### CLAUDE.md Updates

- **New Section 1.5** — Orchestrator Design: documents why subagents were introduced, how spawning works, model assignments, validation gates, error handling, and directory layout
- **Section 1.2** rewritten to show orchestrator → subagent flow diagram
- **Section 1.4** updated with v3.1 agent config locations (`agents/` primary, `config/` archive)
- **Section 3.2** updated with orchestrator-gated handoff contracts (orchestrator validates between agent spawns)
- All `config/agent_*.md` cross-references migrated to `agents/agent-*.md`

### Alignment Check Protocol

4 new checks added for v3.1 verification:
- **2.5**: `agents/` directory manifest — all 3 files exist with v3.1 headers
- **10.5**: Orchestrator completeness — spawn logic, validation gates, error handling, logging
- **10.6**: Model consistency — Agent 2 = Sonnet, Agents 3/4 = Opus across all docs
- **11.12**: No stale `config/agent_*.md` references in runtime docs

Total checks: **62** (up from 58 in v3.0).

### Scheduled Tasks

Both scheduled tasks updated in-place with orchestrator prompts:
- `v3-daily-pipeline` (daily 9:08 AM) — now reads orchestrator logic, spawns Agent 2 + 3 as subagents
- `v3-weekly-learning` (Sunday 10:03 AM) — now reads orchestrator logic, spawns Agent 4 as subagent

## Also Included: v3.0.1 Degradation Fixes

This release bundles 6 fixes that were developed alongside the architecture migration:

1. **Convergence validation gate** — If >50% of themes flagged convergent, re-run with stricter matching (2+ shared keyword combos OR 3+ shared author handles)
2. **Theme label specificity** — Labels must reference specific protocols/projects. Banned: "Crypto general", "Market sentiment", "DeFi ecosystem"
3. **Typefully confidence floor** — Only push replies with confidence >= 6 to Typefully. Below-floor replies stay in spreadsheet for manual review
4. **Keyword probation protocol** — New keywords tagged `(NEW)` for 3 days, don't count toward health metrics. Keywords with 0 results for 3 days marked DORMANT
5. **Angle distribution tracking** — `analytics_history.jsonl` now includes `angle_distribution` object with counts and percentages for cross-pollinated, own-perspective, and research-informed angles
6. **Tangential theme reply cap** — Themes with topic relevance 4-6 capped at max 2 replies each

## Technical Details

### How Subagent Spawning Works

The orchestrator uses the Cowork Agent tool:

```
Agent(
  subagent_type: "general-purpose",
  model: "sonnet",  // or "opus"
  description: "Agent 2 daily data pull",
  prompt: <full 816-line agent config from agents/agent-daily-pull.md>
)
```

Each subagent receives the **complete** agent config as its prompt. The subagent then follows its internal Step 0 (Load Context) to read CLAUDE.md, data files, and other dependencies. It operates in complete isolation — no awareness of the orchestrator or other agents.

### Validation Gates

The orchestrator checks output files between agent spawns:

| Gate | What's Checked | On Failure |
|------|---------------|------------|
| Pre-flight → Agent 2 | Profile exists, data files initialized | Pipeline aborted |
| Agent 2 → Agent 3 | `daily_posts.json` has today's key, ≥1 theme, fresh timestamp | Agent 3 never spawns |
| Pre-flight → Agent 4 | ≥1 day of analytics in last 7 days | Weekly learning skipped |

### Model Assignments

| Agent | Model | Rationale |
|-------|-------|-----------|
| Agent 1 (Onboarding) | Opus 4.6 | Complex voice extraction, profile construction |
| Agent 2 (Daily Pull) | Sonnet 4.6 | Structured data retrieval, API orchestration |
| Agent 3 (Analytics) | Opus 4.6 | Nuanced voice matching, creative content generation |
| Agent 4 (Weekly Learning) | Opus 4.6 | Deep trend analysis, strategic recommendations |
