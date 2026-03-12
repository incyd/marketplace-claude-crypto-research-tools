# V3 Daily KOL

> **v3.1 — Isolated Subagent Architecture** · [What changed](./CHANGELOG.md)

Most crypto content tools treat every day as day one. V3 Daily KOL doesn't.

It builds a **personalized context database** that grows with every run — accumulating your niche's post history, signal patterns, narrative trajectories, and knowledge base across sessions. The longer it runs, the better it understands which narratives are gaining momentum in your specific corner of the market, which thought leaders are worth watching, and which topics actually land with your audience.

That accumulated context is what drives discovery. Instead of generic trending topics, you get narratives that are actually relevant to your niche — ranked by signal, validated across sources, and tracked through their lifecycle from emerging to established to fading.

---

## What you get each day

**`engagement_replies.xlsx`** — 20+ ready-to-post replies, each with:
- The post you're replying to (ID, author, text)
- A confidence score (0–10)
- The reply text, voice-matched and humanized
- CTA included/excluded decision with reason

**`own_post_recs.xlsx`** — 2–3 original post recommendations, each with:
- Topic and angle
- `rec_score` (signal strength × convergence × coverage gap × topic fit × timeliness)
- Supporting data points pulled live from Tavily
- Draft copy in your voice

**`web3_knowledge_base.md`** — the growing narrative intelligence layer. Tracks active narratives, fading narratives, and what's on the rise — with lifecycle stages (EMERGING → ACCELERATING → ESTABLISHED → FADING → DEAD) updated weekly. This is the memory that makes recommendations sharper over time.

---

## The four agents

```
Agent ① Onboarding     (Opus 4.6)  — run once per account
         ↓
Daily Orchestrator     — spawns isolated subagents
  ├─ Agent ② Daily Pull  (Sonnet 4.6) → own context window
  ├─ validate output
  └─ Agent ③ Analytics   (Opus 4.6)  → own context window
         ↓
Weekly Orchestrator    — spawns isolated subagent
  └─ Agent ④ Weekly      (Opus 4.6)  → own context window
```

### Agent ① — Onboarding
Run once. Point it at your X handle and it pulls 200 of your recent posts, extracts your topics, keyword combinations, writing voice, competitors, and thought leaders. Writes `account_profile.md` — the foundation every other agent reads from. This profile is what makes the context database yours, not generic.

### Agent ② — Daily Pull
Three parallel data modes every morning:

- **Mode A (Topics)** — Searches your keyword combos via Kaito AI, clusters results into themes, scores by engagement signal. Each run appends to the context database, building a longitudinal view of narrative momentum.
- **Mode B (Thought Leaders)** — Pulls the last 24h from your tracked KOL list. Filters for freshness and topic relevance to your profile.
- **Mode C (Own Posts)** — Syncs your recent posts so Agent ③ and ④ can track what you actually published versus what was recommended.

All posts normalized to a 23-field canonical schema. Appended to `daily_posts.json` — date-keyed, never overwritten.

### Agent ③ — Analytics & Content
Reads today's context, ranks themes by signal, generates replies and post recommendations enriched with live Tavily data.

Signal scoring:
```
engagement_score = (replies × 27) + (retweets × 20) + (quotes × 24) + (likes × 1) + (bookmarks × 4)
signal_score     = engagement_score / views × 1000
```
Convergence bonus (+2.0) when the same narrative surfaces from multiple independent sources on the same day — the strongest signal that something is actually moving.

Every reply goes through a mandatory humanizer pass. Em dashes are zero tolerance. Output reads as yours.

### Agent ④ — Weekly Learning
Where the persistent memory gets updated. Runs Sundays, looks back across 7 days of accumulated data — signals, recommendations, what you posted, keyword performance, narrative stage shifts. Outputs three proposal files for your review:

1. **`knowledge_edit_proposals/`** — narrative stage transitions, new narratives to add (Tavily-validated with 3+ sources), content updates to existing entries
2. **`effectiveness_reports/`** — keyword performance, theme coverage gaps, recommendation adoption rate
3. **`claude_md_proposals/`** — system tuning, keyword replacements, operational learnings

All proposals require your review before anything changes. Nothing in the context database updates automatically.

---

## Persistent memory

The context database is append-only. Nothing is ever overwritten — the full history accumulates across every run, every day.

| Layer | File | What accumulates |
|-------|------|-----------------|
| Account context | `account_profile.md` | Your topics, keywords, voice, KOL list — written once by Agent ① |
| Signal history | `daily_posts.json` | Date-keyed batches of scored posts, growing daily |
| Your post history | `own_posts.jsonl` | Every post you publish, tracked and deduped |
| Performance history | `analytics_history.jsonl` | One record per day — theme counts, confidence averages |
| Narrative intelligence | `web3_knowledge_base.md` | Lifecycle-tracked narratives, updated weekly |
| Weekly learning | `weekly/*/` | Proposals for KB edits, keyword changes, system improvements |

Agent ④ is the only agent that reads across the full history. The longer the system runs, the more accurately it can identify which narrative shifts are real versus noise, and which topics consistently drive engagement for your specific account.

---

## Required MCP connectors

| Connector | Used for | Priority |
|-----------|----------|----------|
| **Kaito AI** | Topic discovery — mindshare, sentiment, advanced search | Primary |
| **X API (Connector B)** | Tweet fetching, TL timelines, own-post sync | Primary |
| **Tavily** | Live web enrichment per theme, data sourcing for recs | Required |
| **X API (Connector A)** | Fallback search only — expensive, last resort | Fallback |

→ See [connectors/](../connectors/) for setup guides for each.

---

## Setup

### Step 1 — Run Agent ① (Onboarding)

```
Run Agent ① onboarding for @yourtwitterhandle
```

Takes ~10 minutes. Reads 200 of your recent posts and builds your account profile. You only do this once per account.

### Step 2 — Run Agent ② + ③ daily

```
Run Agent ② daily pull
```

Runs Modes A, B, and C, then chains automatically into Agent ③. `engagement_replies.xlsx` and `own_post_recs.xlsx` will be updated by end of run.

### Step 3 — Run Agent ④ on Sundays

```
Run Agent ④ weekly learning
```

Review proposals in `weekly/`. Apply what makes sense.

---

## Rate limits

| Connector | Budget |
|-----------|--------|
| Kaito | 80 calls/day across all agents |
| X API (Connector B) — `get_user_tweets` | 23 calls/day for Mode B |
| Tavily | 10 calls per Agent ③ run |
| X API (Connector A) — search | 10 calls/day max, last resort only |

---

> Currently configured for `@incyd__` (DeFi yields, AI tooling, RWA). Agent ① re-onboards for any account — the context database is fully isolated per account.
