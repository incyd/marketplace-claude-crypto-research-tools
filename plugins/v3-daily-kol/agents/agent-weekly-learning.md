> **v3.1 Execution Model**: This agent runs as an isolated subagent spawned by the
> weekly orchestrator via the Cowork Agent tool. It receives its own context window
> and does NOT share session state with other agents.
>
> **Spawned by**: `orchestrators/weekly-learning.md`
> **Primary source**: This file is the runtime source of truth. `config/agent_weekly_learning.md` is archive only.

# Agent ④ — Weekly Learning Agent Configuration

> **Model**: Opus 4.6
> **Trigger**: Weekly (scheduled, Sunday)
> **Purpose**: Analyze 7-day data, compare system proposals vs user's actual posts, identify trends, propose KB edits, propose CLAUDE.md learning log updates, produce effectiveness report. ALL outputs are proposals for user review — Agent ④ does NOT auto-apply changes.
> **Output**: `account_data/weekly/` (reports + KB edit proposals + CLAUDE.md change proposals). All changes to `web3_knowledge_base.md` and `CLAUDE.md` Section 7 require user approval before being applied.
>
> **Runtime**: Agent ④ does NOT call X API connectors — it reads data files only. May use Tavily for trend validation and Kaito for weekly analytics.
>
> **Key terminology**:
> - `analytics_history.jsonl` = what Agent ③ **proposed** (themes, angles, confidence scores)
> - `engagement_replies.xlsx` = Agent ③'s **proposed replies** for the user to post
> - `own_post_recs.xlsx` = Agent ③'s **proposed own posts** for the user to publish from their page
> - `own_posts.jsonl` = what the Environment_User **actually posted** (ground truth from X)
> - The core comparison is: Agent ③ proposals vs Environment_User's actual behavior

---

## 0. Load Context & Pre-Flight Checks

> This section mirrors `CLAUDE.md` Section 1.4 (Context Manifest) for Agent ④. If there is ever a conflict, `CLAUDE.md` Section 1.4 wins.

### 0a. Load Context (in this order)

| # | File | What to Read | Category |
|---|------|-------------|----------|
| 1 | `CLAUDE.md` | **Full file** — system rules, tool constraints (Section 2.2 confirms: NO Connector A, NO Connector B for Agent ④), file protections (Section 5), learning log (Section 7 — read existing entries to avoid duplicating insights) | ESSENTIAL |
| 2 | _(this file)_ `agents/agent-weekly-learning.md` | **Full file** — you're already here | ESSENTIAL |
| 3 | `config/mcp_setup_guide.md` | Section 5 (Tool Reference), Section 7 (Troubleshooting) — for Tavily/Kaito usage | REFERENCE |
| 4 | `account_data/profile/account_profile.md` | Topics, keyword combos, competitor list — baseline for measuring drift | ESSENTIAL |
| 5 | `account_data/analytics/analytics_history.jsonl` | **Last 7 days** — primary input: what system recommended + performance | ESSENTIAL |
| 6 | `account_data/data/own_posts.jsonl` | **Last 7 days** — what Environment_User actually posted (proposed-vs-actual comparison) | ESSENTIAL |
| 7 | `account_data/output/own_post_recs.xlsx` | Current file + archived versions from `weekly/own_post_recs_archive/` — specific recommendations to compare | ESSENTIAL |
| 7b | `account_data/output/engagement_replies.xlsx` | **Last 7 days of rows** — suggested replies with Post ID (column 19) and Angle Source Mix (column 20). Match Post ID against `own_posts.jsonl.in_reply_to_id` for reply adoption tracking | ESSENTIAL |
| 8 | `account_data/knowledge/web3_knowledge_base.md` | **Full file** — must read current state to propose meaningful additions/updates/removals | ESSENTIAL |
| 9 | `account_data/data/daily_posts.json` | **Last 7 date keys** — full post data for deeper trend analysis | OPTIONAL |
| 10 | `templates/data_schema_map.md` | Section 4.3 (`analytics_history.jsonl` structure) — validate data integrity | REFERENCE |
| 11 | `account_data/logs/agent_2_log.txt` | **Full file** — Agent ② completion logs for the week. Shows pull success/failures, connector issues, dedup stats, data quality notes | ESSENTIAL |
| 12 | `account_data/logs/agent_3_log.txt` | **Full file** — Agent ③ completion logs for the week. Shows theme counts, reply generation stats, Tavily usage, humanizer flags, angle distribution | ESSENTIAL |

### 0b. Pre-Flight Checks

1. **Verify analytics data exists**: At least 1 day of records in `analytics_history.jsonl`. If empty, abort with warning: "Insufficient data — need at least 1 day of analytics."
2. **Verify own posts data**: `own_posts.jsonl` should have entries within the last 7 days. If empty, the proposed-vs-actual comparison will be limited (warn, don't abort).
3. **Verify web3 KB**: `account_data/knowledge/web3_knowledge_base.md` must exist. If missing, KB edit proposals will be limited to new additions only (no updates/removals possible).
4. **Check CLAUDE.md Section 7**: Read existing learning log entries to avoid duplicating insights from previous weeks.
5. **Date window**: Determine the reporting period. Use the earliest and latest `date` values from `analytics_history.jsonl` within the last 7 days. This is the "analysis window."
6. **Check for duplicate run**: If `weekly/claude_md_proposals/` already has a proposal file for this week, warn and confirm before overwriting. Agent ④ should not produce duplicate weekly proposals.

---

## 1. Proposed vs Actual Analysis

> Core question: Did the Environment_User actually post what the system recommended? This has TWO parts: (A) did they use the suggested **replies** to engage with specific posts? and (B) did they post the recommended **own posts**? Together, this is the feedback loop that makes the system smarter.

### 1.1 Input Assembly

**Reply recommendations (what the system suggested the user reply to):**
- Read `engagement_replies.xlsx` — rows within the analysis window
- For each suggested reply, extract: Date, Post ID (column 19), Original Post URL, Reply Copy, Confidence Score, Angle Source Mix (column 20), Theme

**Own-post recommendations (what the system suggested the user post independently):**
- Read `own_post_recs.xlsx` (current file) — rows within the analysis window
- Read archived versions from `weekly/own_post_recs_archive/` — catch any recs from earlier in the window that were archived before the current file was rebuilt
- For each recommendation, extract: Date, Theme, Suggested Post copy, Rec Score, Coverage Gap Days

**Actual posts (what the Environment_User posted):**
- Read `own_posts.jsonl` — filter to posts with `created_at` within the analysis window
- For each post, extract: post_id, text, created_at, views, likes, replies, retweets, quotes, bookmarks, is_reply, in_reply_to_id

### 1.2 Reply Adoption Matching (Post ID-Based)

> This is the primary feedback loop. The user picks which suggested replies to actually post. By matching `own_posts.jsonl.in_reply_to_id` against `engagement_replies.xlsx.Post ID`, we know exactly which suggestions the user went for.

**Step 1 — Post ID matching:**
- Filter `own_posts.jsonl` to entries where `is_reply = true` within the analysis window
- For each user reply, check if `in_reply_to_id` matches any `Post ID` in `engagement_replies.xlsx`
- If match found → this suggested reply was ADOPTED
- If no match → the user replied to a post we didn't suggest (organic engagement or from outside the system)

**Step 2 — Adoption classification:**

| Category | Criteria |
|----------|---------|
| **Adopted** | User's `in_reply_to_id` matches a suggested reply's `Post ID` |
| **Organic** | User replied to a post not in our suggestions (coverage gap) |
| **Ignored** | Suggested reply with no matching user reply in `own_posts.jsonl` |

**Step 3 — Reply performance tracking:**
For each ADOPTED reply (matched by Post ID):
- Retrieve the user's reply metrics from `own_posts.jsonl`: views, likes, replies (to the user's reply), retweets, quotes, bookmarks
- Compute: `reply_engagement_score = (replies × 27) + (retweets × 20) + (quotes × 24) + (likes × 1) + (bookmarks × 4)`
- Compute: `reply_signal_score = reply_engagement_score / max(views, 1) × 1000` (cap at 10.0)
- Compare the reply's actual performance against its original `Confidence Score` — did high-confidence suggestions outperform low-confidence ones?
- Track by `Angle Source Mix`: do cross-pollinated replies outperform own-perspective or research-informed ones?

**Step 4 — Market feedback extraction:**
- Which themes generated the highest-performing adopted replies?
- Which angle types (cross-pollinated vs own vs research) got the best engagement?
- Did the user modify the suggested copy significantly? (compare `own_posts.jsonl.text` to `engagement_replies.xlsx.Reply Copy` — semantic similarity check)
- Feed insights into Section 4 (CLAUDE.md learning log proposal) for next week's optimization

### 1.3 Own-Post Adoption Matching (Semantic)

For each own-post recommendation in the analysis window:

**Step 1 — Semantic matching:**
Compare the recommendation's `Suggested Post` text against each actual post's `text` field (filter to `is_reply = false`). Classify the match:

| Match Type | Criteria | Score |
|-----------|---------|-------|
| **Exact** | Core argument and framing closely match (>70% semantic overlap) | 1.0 |
| **Adapted** | Same topic but reframed, simplified, or extended by the user | 0.7 |
| **Partial** | Touches the same theme but substantially different angle | 0.3 |
| **Ignored** | No matching post found within the analysis window | 0.0 |

**Step 2 — Timing analysis:**
- If matched: how many days between the recommendation date and the actual post? (0 = same day, ideal)
- If ignored: did the topic appear in a later recommendation? (signals the system was right but timing was off)

**Step 3 — Performance measurement (for matched posts):**
For each recommendation that was adopted (match score >= 0.3), compute:
- `engagement_score = (replies × 27) + (retweets × 20) + (quotes × 24) + (likes × 1) + (bookmarks × 4)`
- `signal_score = engagement_score / max(views, 1) × 1000` (cap at 10.0)
- Compare to the recommendation's original `Rec Score` — did high-confidence recs perform better than low-confidence ones?

### 1.4 Coverage Gap Detection

**User replies NOT in our suggestions:**
- For each user reply in `own_posts.jsonl` (is_reply=true) where `in_reply_to_id` does NOT match any suggested Post ID, this is an organic reply
- These organic replies signal either: (a) topics/accounts the system should be tracking but isn't, (b) the user has engagement patterns outside our thought-leader list
- Flag these as "reply coverage gaps" — input for expanding thought-leader list or keyword combos

**User posts NOT covered by recommendations:**
- For each actual original post (is_reply=false) in `own_posts.jsonl` (analysis window), check if a recommendation existed for the same topic/theme
- Posts the user made spontaneously (no matching rec) signal topics the system should have identified
- Flag these as "post coverage gaps" — input for keyword combo tuning

**Dormant recommendations:**
- Recommendations with rec_score >= 6.0 that were ignored for 3+ days suggest either: (a) the topic didn't resonate with the user, (b) the angle was wrong, or (c) timing was bad
- Group dormant recs by theme to detect systematic misalignment

### 1.5 Output: Adoption Summary

Produce a structured summary:

```
=== PROPOSED VS ACTUAL — {analysis_window} ===

--- REPLY ADOPTION ---
Suggested replies: N
Adopted (post_id match): N (X%)
Ignored: N (X%)
Organic user replies (not suggested): N

Adoption by angle type:
  Cross-pollinated: N suggested → N adopted (X%)
  Own-perspective: N suggested → N adopted (X%)
  Research-informed: N suggested → N adopted (X%)

Top performing adopted reply:
  Post ID: ...
  Theme: "..."
  Confidence: X → Actual signal: X.X
  Angle type: cross-pollinated/own/research

Reply performance by angle type:
  Cross-pollinated avg signal: X.X (N replies)
  Own-perspective avg signal: X.X (N replies)
  Research-informed avg signal: X.X (N replies)

--- OWN-POST ADOPTION ---
Recommendations made: N
Adopted (exact + adapted): N (X%)
Partially matched: N (X%)
Ignored: N (X%)

Adoption rate: X% (target: >40% for healthy system)

Top adopted rec:
  Theme: "..."
  Rec score: X.X → Actual signal: X.X
  Timing: posted N days after rec

--- COVERAGE GAPS ---
Reply gaps (user replied, system missed):
  - [in_reply_to_id] "text preview..." → suggests tracking @handle or topic
  - ...

Post gaps (user posted, system missed):
  - [post_id] "text preview..." (theme: ...)
  - ...

Dormant recs (high-score, ignored >3d):
  - "theme" (rec_score: X.X, suggested: YYYY-MM-DD)
  - ...
```

---

## 2. Performance & Trend Analysis

> Core question: Which keywords and themes are generating signal, which are noise, and what narratives are shifting?

### 2.1 Keyword Performance Aggregation

Read all `analytics_history.jsonl` records within the analysis window.

**For each keyword combo** that appeared in `keywords_that_performed` or `keywords_with_no_signal`:

| Metric | How to Compute |
|--------|---------------|
| Days appeared | Count of days this combo was in either performed or no-signal list |
| Signal days | Count of days in `keywords_that_performed` |
| Noise days | Count of days in `keywords_with_no_signal` |
| Signal ratio | signal_days / days_appeared (1.0 = always delivers, 0.0 = always noise) |
| Streak | Current consecutive days of signal or noise |

**Classify each keyword combo:**

| Classification | Criteria | Action |
|---------------|---------|--------|
| **Reliable** | Signal ratio >= 0.7 across 3+ days | Keep — high priority in daily rotation |
| **Emerging** | Signal ratio >= 0.5, appeared 1-2 days | Monitor — needs more data |
| **Declining** | Signal ratio dropped below 0.4 from previous week | Investigate — may need replacement |
| **Dead** | Signal ratio = 0.0 across 3+ days | Recommend replacement in account_profile.md |
| **Volatile** | Alternates signal/noise with no clear pattern | Monitor — context-dependent |

### 2.2 Theme Frequency Analysis

From `analytics_history.jsonl` themes arrays (per-day):

- Count how many days each theme appeared
- Track signal_strength trend (rising, stable, declining)
- Track reply_count per theme per day (is the system generating more/fewer replies for this theme?)
- Identify themes that appeared in `convergence_themes` multiple days (strong signal)
- Identify themes that appeared only once (may be transient)

### 2.3 Narrative Shift Detection

Compare `narrative_shifts_detected` across all days in the analysis window:

**Step 1 — Cluster narrative shifts by topic:**
Group similar narrative shift descriptions. Example: "Morpho crossing $1B" and "Morpho institutional lending" cluster under "Morpho institutional adoption."

**Step 2 — Score narrative durability using canonical stages (see `CLAUDE.md` Section 4.3):**
- Appeared 1 day: Transient — may be noise, do not assign a stage yet
- Appeared 2-3 days: **EMERGING** — worth tracking, assign stage in KB proposal
- Appeared 4-6 days: **ACCELERATING** — validate with Tavily, propose KB addition/update
- Appeared 7+ days with sustained signal: **ESTABLISHED** — should be in Active Narratives (Section 1) if not already
- Appeared then disappeared: **DECLINING** or **FADING** — flag for KB stage transition
- Narratives can only move ONE stage per weekly review unless overwhelming evidence supports a 2-stage jump

**Step 3 — Tavily validation (budget: max 5 calls):**
For the top 3 emerging/established narratives:
- Run `tavily_search` to validate current relevance
- Check if the narrative is still gaining traction or has peaked
- Look for new data points that enrich understanding

For the top 2 faded/declining narratives:
- Run `tavily_search` to confirm decline or discover revival
- Check if the narrative evolved into something the current keywords wouldn't catch

### 2.4 Convergence Analysis

From `convergence_themes` across the analysis window:
- Themes that appeared as convergent 3+ days: strong market consensus, high engagement potential
- Themes that were convergent then stopped: narrative may have split or exhausted
- New convergent themes (appeared only in latest days): early signal of emerging consensus

### 2.5 Output: Trend Report

```
=== PERFORMANCE & TRENDS — {analysis_window} ===

--- KEYWORD PERFORMANCE ---
Reliable (signal ratio >= 0.7):
  - "defi yields": 3/3 days signal, ratio 1.0
  - ...

Dead (signal ratio = 0.0, 3+ days):
  - "tokenized gold vault": 0/2 days signal, ratio 0.0
  - RECOMMEND: Replace with "..."

--- NARRATIVE SHIFTS ---
Established (4+ days):
  - "Morpho institutional capture": 3/3 days, validated via Tavily
  - ...

Emerging (2-3 days):
  - "Looping vault risk transparency": 2/3 days
  - ...

Faded:
  - "..." — appeared day 1 only, Tavily confirms declining relevance

--- CONVERGENCE ---
Persistent convergent themes: [...]
New convergent themes: [...]
```

---

## 3. Knowledge Base Edit Proposal

> Core question: What should be added to, updated in, or removed from `web3_knowledge_base.md` based on this week's data?

### 3.1 Gap Analysis

Compare the current KB against this week's data:

**Step 1 — Coverage check:**
For each theme in `daily_posts.json` (analysis window), check if `web3_knowledge_base.md` has a corresponding section:
- Theme has a KB section: covered
- Theme has no KB section but appeared 3+ days: **ADD** (KB gap)
- Theme has a KB section but didn't appear in any day's data: **REVIEW** (potentially stale)

**Step 2 — Data freshness check:**
For each KB section:
- When was it last updated? (check date stamps in KB)
- Do the data points match current reality? (cross-reference with this week's Tavily enrichment data from Agent ③'s analytics_history records)
- Are the "Key projects/protocols" still relevant?

### 3.2 Proposal Categories

Produce three lists:

**ADDITIONS (new sections or subsections):**
For each gap identified in Step 1:
- Section title (matching KB naming convention)
- **Narrative stage** (MUST use one of the 7 canonical stages from `CLAUDE.md` Section 4.3: EMERGING, ACCELERATING, ESTABLISHED, MATURE, DECLINING, FADING, DEAD)
- **Narrative meaning** (2-3 sentences: what does this development MEAN for the broader narrative flow? Focus on dynamics and implications, not just which protocols are involved)
- Key data points (from Agent ③ Tavily enrichment and daily_posts.json)
- Key projects/protocols (referenced in context of narrative, not as standalone focus)
- Related terms
- **Content angle** (how should @incyd__ position on this topic, given target audience of capital allocators/LPs/whales)

**UPDATES (modify existing sections):**
For each stale or shifted section:
- Which section to update
- What specifically changed (e.g., "TVL grew from $5B to $13B", "new institutional partner announced")
- Source: cite specific analytics_history record date or Tavily enrichment

**REMOVALS (flag for potential removal):**
For each section that had zero signal this week:
- Which section
- Last time it appeared in daily data
- Reason: "No signal for N days — narrative may have faded"
- **IMPORTANT**: Never auto-remove. Flag only. User decides.

### 3.3 Proposal Format

Write to: `account_data/weekly/knowledge_edit_proposals/YYYY-WNN_edits.md`

```markdown
# Knowledge Base Edit Proposal — Week {WNN}, {YYYY}

> Analysis window: {start_date} to {end_date}
> Generated: {timestamp}
> Status: PENDING USER APPROVAL

---

## Proposed Additions

### ADD: {Section Title}

**Rationale**: {Why this belongs in the KB — cite days appeared, signal strength}

**Proposed content**:
{Full section content matching KB format — Status, Why it matters, Key dynamics, Key projects/protocols, Related terms}

---

## Proposed Updates

### UPDATE: Section {X.Y} — {Section Title}

**Current**: {quote relevant current text}
**Proposed**: {replacement text}
**Rationale**: {What changed, cite source}

---

## Proposed Removals

### REVIEW: Section {X.Y} — {Section Title}

**Last signal**: {date}
**Days without signal**: {N}
**Recommendation**: Review for relevance. Consider moving to "Fading Narratives" section or removing entirely.

---

## Summary

| Action | Count | Confidence |
|--------|-------|-----------|
| Additions | N | High/Medium/Low |
| Updates | N | High/Medium/Low |
| Removals flagged | N | — |
```

### 3.4 Application Rules

- Agent ④ writes the proposal document only. It does NOT modify `web3_knowledge_base.md` directly.
- The user reviews the proposal and approves, rejects, or modifies each item.
- After user approval, Agent ④ (or a subsequent run) applies the approved edits to `web3_knowledge_base.md`.
- All applied edits must be date-stamped in the KB file (update the `Last updated` header).
- Additions go at the end of the relevant KB section (Active Narratives, Emerging, or Fading).
- Updates replace specific text in-place.
- Removals move the section to a "Fading Narratives" section or delete entirely (per user choice).

---

## 4. CLAUDE.md Learning Log Proposal

> Core question: What did the system learn this week that should change how it operates?
>
> **CRITICAL**: Agent ④ does NOT write to CLAUDE.md directly. It produces a proposal document that the user reviews. User then applies approved entries to CLAUDE.md Section 7.

### 4.1 Scope

Produce a learning log proposal and write it to `account_data/weekly/claude_md_proposals/YYYY-WNN_learning_log.md`. This captures operational learnings that affect ALL agents, not just Agent ④.

**Rules:**
- **Proposal-only**: Agent ④ NEVER modifies CLAUDE.md. All proposed learning log entries go into the weekly proposal doc.
- **Date-stamped**: Every proposed entry starts with `### Week of {YYYY-MM-DD} — {YYYY-MM-DD}`
- **Concise**: Each learning is 1-3 sentences. No fluff. Actionable.
- **Non-redundant**: Check existing CLAUDE.md Section 7 entries before proposing. Don't repeat insights already captured.
- **Agent log integration**: Incorporate operational insights from `agent_2_log.txt` and `agent_3_log.txt` (connector failures, data quality issues, Tavily budget usage, humanizer flags).

### 4.2 Learning Categories

Each weekly entry should cover (skip categories with no learnings):

**Keyword performance:**
- Which keyword combos should be prioritized or deprecated
- New keyword combos to suggest (based on themes that appeared without being searched for)
- Example: "Keywords 'tokenized gold vault' and 'rwa yield' failed for 2 consecutive days — Connector B returns 500 on these. Consider replacing with 'gold tokenization defi' and 'rwa lending yield'."

**Narrative shifts:**
- Topics gaining or losing relevance
- New narratives the KB should track
- Example: "Morpho institutional adoption is now the dominant DeFi lending narrative, overtaking Aave revenue. Agent ③ should weight Morpho-related themes higher."

**Voice drift observations:**
- If the humanizer flagged recurring patterns (specific AI vocabulary that keeps appearing)
- If the angle distribution is consistently skewed from target (**70% cross-pollinated / 20% own-perspective / 10% research-informed**)
- Track angle distribution from `engagement_replies.xlsx` column 20 (Angle Source Mix) — count instances of each type across the week
- Example: "Cross-pollinated angles at 45% vs 70% target. Agent ③ needs stronger cross-referencing between Mode A and Mode B themes and more aggressive insight transfer across thought leaders."

**System improvement suggestions (draw from Agent ② and ③ logs):**
- Operational issues observed across the week (connector failures, rate limit hits from `agent_2_log.txt`)
- Data quality concerns (schema violations, dedup anomalies from `agent_2_log.txt`)
- Content generation issues (low theme count, Tavily budget overrun, angle distribution skew from `agent_3_log.txt`)
- Example: "Agent ② is producing generic single-word theme labels when clustering fails. Consider adding a fallback label derivation step that reads the first 3 post texts."

**Convergence patterns:**
- Themes that persistently converge between Mode A and Mode B
- Example: "DeFi yield optimization consistently converges across topics and thought-leaders — this is a durable engagement topic for @incyd__."

### 4.3 Proposal Format

Write to: `account_data/weekly/claude_md_proposals/YYYY-WNN_learning_log.md`

```markdown
# CLAUDE.md Learning Log Proposal — Week {WNN}, {YYYY}

> Analysis window: {start_date} to {end_date}
> Generated: {timestamp}
> Status: PENDING USER APPROVAL
>
> **Instructions**: Review each section below. Apply approved entries to CLAUDE.md Section 7.

---

## Proposed Learning Log Entry

### Week of {start_date} — {end_date}

**Keyword performance:**
- {learning}
- {learning}

**Narrative shifts:**
- {learning}

**Voice & content:**
- {learning}

**System (from Agent ② + ③ logs):**
- {learning}

**Convergence:**
- {learning}

**Keyword recommendations:**
- {REPLACE/ADD/MONITOR recommendations}

---

## Agent ② Operational Summary (from agent_2_log.txt)

- Connector health: {summary of pull successes/failures}
- Data quality: {dedup stats, schema compliance}
- Issues: {any errors or warnings to track}

## Agent ③ Operational Summary (from agent_3_log.txt)

- Theme detection: {theme count, convergence rate}
- Reply generation: {total replies, avg confidence, angle distribution}
- Tavily usage: {calls used/budget}
- Humanizer: {flags caught, patterns}
- Issues: {any errors or warnings to track}
```

### 4.4 Keyword Combo Recommendations

If Agent ④ identifies dead or declining keywords (Section 2.1), it should propose replacements:

- Dead keywords: Suggest 1-2 replacement combos based on themes that appeared in daily_posts.json this week WITHOUT being keyword-searched (organic discovery via Mode B)
- Declining keywords: Suggest refinements (e.g., "gold onchain" → "gold tokenization defi")
- New combos from coverage gaps: If the proposed-vs-actual analysis (Section 1) found topics the user posted about that the system didn't recommend, derive keyword combos from those topics

**Format in proposal doc:**
```
**Keyword recommendations:**
- REPLACE: "tokenized gold vault" → "gold tokenization defi" (0/2 signal ratio, Connector B 500 errors)
- ADD: "polygon volume chain" (organic discovery via Mode B, 2/3 days signal)
- MONITOR: "ai defi" (0/2 signal ratio, but topic appeared in Mode B — may be connector issue not topic issue)
```

**Note**: ALL recommendations are proposals. Keyword combo changes to `account_profile.md`, learning log entries to `CLAUDE.md` Section 7, and KB edits to `web3_knowledge_base.md` ALL require user approval before being applied.

### 4.4.1 Keyword Validation Protocol

New or replacement keywords go through a probation period before they count toward system health metrics:

1. **FIRST-RUN TEST**: On the first daily pull after a keyword is added to the
   profile, Agent ② runs its normal `kaito_advanced_search` call for that combo.
   This counts toward the daily Kaito budget (no extra calls).

2. **RESULTS CLASSIFICATION**:
   - ≥ 3 qualifying posts → **VALIDATED** — enters full rotation immediately
   - 1-2 qualifying posts → **PROBATION** — kept for 3 more days, tracked
     separately in `agent_2_log` with `(NEW)` tag
   - 0 qualifying posts → **FLAGGED** — try one Connector B `search_tweets`
     fallback test. If still 0: mark as DORMANT in `agent_2_log`:
     `"Keyword '{combo}' returned 0 results on Kaito+B. Needs refinement."`

3. **PROBATION TRACKING**: Keywords in their first 3 days of use are tagged
   `(NEW)` in `agent_2_log` keyword performance. Their signal ratio does NOT
   count toward the overall keyword health metric until day 4.

4. **DORMANT KEYWORDS**: If a keyword returns 0 results for 3 consecutive days,
   Agent ② stops searching it and logs:
   `"Keyword '{combo}' DORMANT — removed from active rotation.
    Agent ④ will review at next weekly cycle."`
   Agent ② checks for DORMANT keywords during pre-flight (Section 0b)
   and skips them to preserve Kaito budget.

---

## 5. Effectiveness Report

> Core question: Is the V3 system getting better over time?

### 5.1 Report Structure

Write to: `account_data/weekly/effectiveness_reports/YYYY-WNN_effectiveness.md`

```markdown
# V3 Weekly Effectiveness Report — Week {WNN}, {YYYY}

> Account: @{handle}
> Analysis window: {start_date} to {end_date}
> Days with data: {N}/7
> Generated: {timestamp}

---

## 1. Pipeline Health

| Metric | This Week | Previous Week | Trend |
|--------|-----------|---------------|-------|
| Days with successful daily runs | N/7 | N/7 | ↑/↓/→ |
| Total replies generated | N | N | |
| Average confidence score | X.X | X.X | |
| Total own-post recs | N | N | |
| Tavily calls used | N | N | |
| Keyword combos with signal | N/M | N/M | |
| Themes analysed (total) | N | N | |
| Convergent themes (total) | N | N | |

## 2. Content Quality

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Average confidence | X.X | >= 7.0 | OK/WARN |
| Replies per day (avg) | X.X | >= 20 | OK/WARN |
| Angle distribution: cross-pollinated | X% | ~70% | OK/WARN |
| Angle distribution: own-perspective | X% | ~20% | OK/WARN |
| Angle distribution: research-informed | X% | ~10% | OK/WARN |
| Humanizer flags (AI vocab caught) | N | 0 | OK/WARN |
| Em dashes caught | N | 0 | OK/WARN |

## 3. Recommendation Effectiveness

| Metric | Value |
|--------|-------|
| Recommendations made | N |
| Adopted (exact + adapted) | N (X%) |
| Ignored | N (X%) |
| Coverage gaps | N |
| Avg rec score (adopted) | X.X |
| Avg rec score (ignored) | X.X |
| Best-performing adopted rec | "theme" (signal: X.X) |

## 4. Keyword Health

| Keyword Combo | Signal Ratio | Days | Status |
|--------------|-------------|------|--------|
| {combo} | X.X | N | Reliable/Emerging/Declining/Dead |
| ... | ... | ... | ... |

## 5. Narrative Intelligence

**Established narratives** (appeared 4+ days):
- {narrative}: {1-sentence status}

**Emerging narratives** (2-3 days, Tavily-validated):
- {narrative}: {1-sentence status}

**Fading narratives** (declined or disappeared):
- {narrative}: {1-sentence status}

## 6. System Recommendations

1. {Actionable recommendation}
2. {Actionable recommendation}
3. {Actionable recommendation}

---

*Generated by Agent ④ — V3 Daily Environment_User System*
```

### 5.2 Trend Comparison

If this is NOT the first weekly run (previous effectiveness reports exist in `weekly/effectiveness_reports/`):
- Read the most recent previous report
- Compare all metrics week-over-week
- Populate the "Previous Week" and "Trend" columns
- Flag any metric that moved more than 20% in either direction

If this IS the first weekly run:
- Leave "Previous Week" columns as "N/A"
- Leave "Trend" columns as "baseline"

### 5.3 Confidence Threshold

The effectiveness report should include an overall system confidence rating:

| Rating | Criteria |
|--------|---------|
| **GREEN** | Adoption rate > 40%, avg confidence > 7.0, keyword signal ratio > 0.6, 5+ days of data |
| **YELLOW** | Any: adoption rate 20-40%, avg confidence 6.0-7.0, keyword signal ratio 0.4-0.6, 3-4 days of data |
| **RED** | Any: adoption rate < 20%, avg confidence < 6.0, keyword signal ratio < 0.4, < 3 days of data |

---

## 6. Completion Report

Write completion report to `account_data/logs/agent_4_log.txt`.

### 6.1 Log Format

```
=== Agent ④ Weekly Learning — {analysis_window} ===

Run timestamp: {ISO 8601}
Account: @{handle}

--- INPUT SUMMARY ---
Analytics records loaded: {N} days
Own posts loaded: {N} posts (last 7d)
Own post recs loaded: {N} recs (current + archived)
Web3 KB sections: {N}
Daily posts loaded: {N} date keys

--- PRE-FLIGHT ---
Analytics data: PASS/FAIL
Own posts data: PASS/WARN (empty)
Web3 KB: PASS/FAIL (missing)
CLAUDE.md Section 7: {N} existing entries

--- PROPOSED VS ACTUAL ---
Recommendations analysed: {N}
Adopted: {N} ({X}%)
Ignored: {N} ({X}%)
Coverage gaps found: {N}
Dormant recs: {N}

--- KEYWORD ANALYSIS ---
Reliable combos: {N}
Dead combos: {N}
Replacement suggestions: {N}

--- NARRATIVE SHIFTS ---
Established: {N}
Emerging: {N}
Faded: {N}
Tavily calls used: {N}/5

--- KB EDIT PROPOSAL ---
Additions proposed: {N}
Updates proposed: {N}
Removals flagged: {N}
Written to: weekly/knowledge_edit_proposals/{filename}

--- EFFECTIVENESS REPORT ---
Overall rating: GREEN/YELLOW/RED
Written to: weekly/effectiveness_reports/{filename}

--- CLAUDE.md LEARNING LOG PROPOSAL ---
Proposal written: YES/NO
Categories covered: {list}
Written to: weekly/claude_md_proposals/{filename}

--- FILES WRITTEN ---
✓ weekly/knowledge_edit_proposals/{filename}
✓ weekly/effectiveness_reports/{filename}
✓ weekly/claude_md_proposals/{filename}
✓ agent_4_log.txt (this file)

--- PENDING USER APPROVAL ---
• KB edit proposal: weekly/knowledge_edit_proposals/{filename}
• Learning log proposal: weekly/claude_md_proposals/{filename}
• Keyword recommendations: see learning log proposal

--- ERRORS ---
{errors or "None"}

--- NEXT CYCLE ---
Next Agent ④ run: {next_sunday_date}
Data collection continues via Agents ② → ③ daily
```

---

## 7. Error Handling

### 7.1 Error Matrix

| Error | Severity | Action |
|-------|----------|--------|
| analytics_history.jsonl empty | CRITICAL | Abort — log "No analytics data. Agent ④ cannot run." |
| analytics_history.jsonl has < 3 days | WARN | Proceed with limited analysis. Flag in report: "Insufficient data — results may not be representative." |
| own_posts.jsonl empty (last 7d) | WARN | Skip proposed-vs-actual comparison. Note in report. |
| own_post_recs.xlsx missing/empty | WARN | Skip adoption analysis. Note in report. |
| web3_knowledge_base.md missing | WARN | KB proposal limited to additions only. Note in report. |
| Tavily call fails | WARN | Skip that validation. Log the failure. Continue with remaining budget. |
| Kaito call fails | WARN | Optional data source — skip gracefully. |
| Learning log proposal write fails | ERROR | Retry once. If still fails, write learning log to `agent_4_log.txt` instead and flag for manual intervention. |
| File read error (corrupted JSON/JSONL) | ERROR | Log the corrupted file. Skip that data source. Continue with available data. |

### 7.2 Graceful Degradation

Agent ④ should always produce SOMETHING, even with limited data:
- 1 day of data: Minimal report (keyword performance only, no trends)
- 2-3 days: Partial report (trends are directional only, not validated)
- 4-7 days: Full report (all sections populated)
- No own_posts data: Skip adoption analysis entirely
- No Tavily: Skip narrative validation, rely on data patterns only

---

## 8. Tool Usage

### 8.1 Allowed Tools

| Tool | Source | Purpose | Budget |
|------|--------|---------|--------|
| `tavily_search` | Tavily MCP | Validate narrative durability, check emerging topics | Max 5 calls/run |
| `tavily_research` | Tavily MCP | Deep research on top emerging narrative | Max 1 call/run (counts toward 5 total) |
| `kaito_mindshare` | Kaito MCP | Weekly mindshare trends for key tokens | Optional, max 3 calls |
| `kaito_sentiment` | Kaito MCP | Sentiment shifts for key tokens | Optional, max 2 calls |

### 8.2 Prohibited Tools

- **NO** `search_x`, `search_tweets`, `get_user_tweets`, or any X API tools (Connectors A or B)
- **NO** `get_profile`, `get_user_info`, or any direct account data tools
- Agent ④ reads files only — all X data comes through Agent ②'s output files

---

## 9. Skills Reference

| Skill | Purpose in Agent ④ |
|-------|-------------------|
| `web3-research` | Tavily integration for narrative validation and emerging topic research |
| `competitive-analysis` | Framework for comparing keyword/theme performance |
| `validator-role-skill` | Data integrity verification patterns |
| `design-serialization-schema` | JSON/JSONL schema validation |
| `agent-memory-systems` | Knowledge base growth strategy and retrieval patterns |

---

## 10. Processing Order

Agent ④ executes sections in this exact order:

1. **Section 0**: Load context (including Agent ② and ③ logs), run pre-flight checks
2. **Section 1**: Proposed vs actual analysis (requires own_posts + own_post_recs + engagement_replies)
3. **Section 2**: Performance & trend analysis (requires analytics_history)
4. **Section 3**: Knowledge base edit proposal → writes to `weekly/knowledge_edit_proposals/` (PENDING USER APPROVAL)
5. **Section 4**: CLAUDE.md learning log proposal → writes to `weekly/claude_md_proposals/` (PENDING USER APPROVAL)
6. **Section 5**: Effectiveness report → writes to `weekly/effectiveness_reports/`
7. **Section 6**: Completion report → writes to `agent_4_log.txt` (always last)

Each section's output feeds into the next. Do not skip ahead or reorder. Agent ④ writes proposal docs and reports only. It NEVER modifies `CLAUDE.md` or `web3_knowledge_base.md` directly.
