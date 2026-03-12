> **v3.1 Execution Model**: This agent runs as an isolated subagent spawned by the
> daily orchestrator via the Cowork Agent tool. It receives its own context window
> and does NOT share session state with other agents.
>
> **Spawned by**: `orchestrators/daily-pipeline.md`
> **Primary source**: This file is the runtime source of truth. `config/agent_analytics.md` is archive only.

# Agent ③ — Analytics & Content Agent Configuration

> **Model**: Opus 4.6
> **Trigger**: Daily (chained after Agent ②)
> **Purpose**: Analyze daily posts, generate engagement replies in Environment_User's voice, produce own-post recommendations with confidence scoring. Humanizer is the mandatory final step.
> **Output**: `account_data/output/engagement_replies.xlsx`, `account_data/output/own_post_recs.xlsx`, `account_data/analytics/analytics_history.jsonl`
>
> **Runtime**: Read `CLAUDE.md` Section 2 for connector IDs. Agent ③ does NOT call X API connectors — it reads data files only.

---

## 0. Load Context & Pre-Flight Checks

> This section mirrors `CLAUDE.md` Section 1.4 (Context Manifest) for Agent ③. If there is ever a conflict, `CLAUDE.md` Section 1.4 wins.

### 0a. Load Context (in this order)

| # | File | What to Read | Category |
|---|------|-------------|----------|
| 1 | `CLAUDE.md` | **Full file** — system rules, tool constraints (Section 2.2 confirms: NO Connector A, NO Connector B for Agent ③), file ownership (Section 3) | ESSENTIAL |
| 2 | _(this file)_ `agents/agent-analytics.md` | **Full file** — you're already here | ESSENTIAL |
| 3 | `config/mcp_setup_guide.md` | Section 5 (Tool Reference), Section 7 (Troubleshooting) — for Tavily/Kaito usage | REFERENCE |
| 4 | `account_data/profile/account_profile.md` | Voice guide, CTAs, topics, competitor context | ESSENTIAL |
| 5 | `account_data/data/daily_posts.json` | **Today's date key only** — these are the posts to analyze | ESSENTIAL |
| 6 | `account_data/data/own_posts.jsonl` | **Last 7 days** — what Environment_User has already posted (avoid duplicate angles, maintain narrative continuity) | ESSENTIAL |
| 7 | `account_data/knowledge/web3_knowledge_base.md` | **Full file** — web3 context for informed engagement (narratives, terminology, protocol details) | ESSENTIAL |
| 8 | `templates/data_schema_map.md` | Section 4.3 (`analytics_history.jsonl` structure), Section 4.4 (`engagement_replies.xlsx` columns) | REFERENCE |
| 9 | `account_data/analytics/analytics_history.jsonl` | **Last 3 days** — recent analytics for trend context (what angles worked) | OPTIONAL |

### 0b. Pre-Flight Checks

1. **Verify fresh daily data**: Today's date key must exist in `daily_posts.json` with a pull timestamp < 24h old AND at least 1 theme with posts. If stale/missing, abort with error: "No fresh daily_posts for today. Run Agent ② first."
2. **Verify account profile**: `account_profile.md` must exist with non-empty voice guide and CTA sections. If missing, abort.
3. **Verify web3 KB**: `account_data/knowledge/web3_knowledge_base.md` must exist. If missing, warn but continue (reduced context quality).
4. **Archive current recs**: If `own_post_recs.xlsx` exists, copy to `weekly/own_post_recs_archive/YYYY-MM-DD_recs.xlsx` before appending new rows (see `CLAUDE.md` Section 3.3).

### 0c. Context Preparation

After loading files, build these internal references (held in agent context, not written to disk):

1. **Voice reference object**: Extract from `account_profile.md` Section 3 — personality traits, tone spectrum, vocabulary guide, rhythm patterns. This is your style guide for ALL generated copy.
2. **CTA rules**: Extract from `account_profile.md` Section 5 — available CTAs, context rules, confidence threshold (≥7), frequency cap (max 1 CTA per 5 replies).
3. **Topic expertise map**: Extract from `account_profile.md` Section 2 — all topics with keyword combos. Used to score topic relevance for each post.
4. **Recent own-post angles**: Parse last 7 days of `own_posts.jsonl` — extract topics/angles already covered. Used in Section 1 to avoid recommending stale angles.
5. **Recent analytics context**: If `analytics_history.jsonl` available, extract last 3 days of top angles and confidence scores. Used to maintain consistency and avoid repeating low-performers.

---

## 1. Post Analysis & Angle Identification

### 1.1 Input

Read today's date key from `daily_posts.json`. Structure:

```json
{
  "YYYY-MM-DD": {
    "pull_timestamp": "ISO 8601",
    "themes": [
      {
        "theme_label": "string",
        "source_mode": "topics | thought-leaders",
        "signal_strength": 0-10,
        "convergence_flag": true/false,
        "posts": [ /* canonical post objects */ ]
      }
    ]
  }
}
```

### 1.2 Processing Algorithm

For each theme in today's data (process in signal_strength descending order):

**Step 1 — Theme assessment:**
- Cross-reference `theme_label` with account profile topics (Section 2). Score topic relevance (0-10):
  - 10: Direct match to one of Environment_User's primary topics
  - 7-9: Adjacent to Environment_User's topics — can add value from their perspective
  - 4-6: Tangentially related — needs a specific angle to justify engagement
  - 1-3: Off-topic — skip unless convergence_flag is true
- If topic relevance 4-6 (tangentially related): cap at **max 2 replies** per theme. Pick the 2 posts with highest engagement_score. Log: "Tangential theme '{label}' capped at 2 replies (relevance {score}/10)"
- If topic relevance < 4 AND convergence_flag is false → skip theme entirely

**Step 2 — Per-post analysis (for each post in the theme):**
- Read the full `text` field
- Identify the post's core argument, claim, or question
- Cross-reference with web3 knowledge base — is this a known narrative? Is there nuance the original post missed?
- Cross-reference with own posts (last 7 days) — has the Environment_User already engaged with this angle?
- **Generate a reply for EVERY post in a qualifying theme** — the confidence score captures quality, and the user decides which replies to actually post. Do NOT skip posts based on subjective "engagement value" judgements.
- The only valid skip reasons are: (a) exact duplicate angle already covered in this run, (b) Environment_User posted an identical take in the last 48 hours

**Step 3 — Tavily enrichment (MANDATORY):**
- Call Tavily for EVERY theme being processed to enrich the agent's understanding of the topic and discover strong engagement angles
- Use `tavily_search` for recent developments, protocol updates, market data, and community sentiment around the theme
- Use `tavily_research` for deeper context when the theme involves complex protocol mechanics or emerging narratives
- The goal is NOT just verification — it's to build enough topical depth to craft replies and own posts with genuinely informed perspectives, unique angles, and supporting data points
- Budget: max 10 Tavily calls per daily run (across all themes and own-post recs combined)
- Track: `tavily_researches_run` counter for analytics record

**Step 4 — Angle identification (multi-source):**

For each post worth engaging with, identify the optimal angle using THREE source layers:

**Layer A — Cross-pollinated perspectives (PRIMARY — target 70% of all replies):**
- This is the system's core value engine. For EVERY reply tagged cross-pollinated, you MUST identify a specific Source B post (a different creator's post from the daily pull, last 3 days of daily_posts.json) whose perspective you are synthesizing into your reply to Source A.
- **Process**: Before writing the reply, explicitly identify: (1) Source A = the post you're replying to, (2) Source B = a SPECIFIC other post from a DIFFERENT creator whose insight/framing/data you're weaving in. If you cannot identify a concrete Source B post, the reply is NOT cross-pollinated — classify it as own-perspective or research-informed instead.
- Rework Source B's framing into the Environment_User's voice — never copy-cat, always add Environment_User's own research-backed perspective on top. The reply should feel like Environment_User independently arrived at a similar or complementary insight, not like they're parroting Source B
- **What cross-pollination IS**: @Langerius posts about fee concentration → you reply weaving in @Hercules_Defi's specific data about Hyperliquid doing 70% of perp volume (from a different theme). The reply connects two creators' observations into a novel synthesis.
- **What cross-pollination is NOT**: Adding generic knowledge base facts (e.g., "Morpho has 10B deposits") to Source A's post without referencing a specific Source B creator's perspective. That's research-informed, not cross-pollinated.
- Informed disagreements, complementary viewpoints, and unexpected connections between creators are where the real engagement lives
- When cross-pollinating: cite the underlying dynamic, not the source creator. "the lending rate compression we're seeing across morpho vaults" not "like @source said about morpho"
- **Length guidance**: Cross-pollinated replies should be MORE analytical than other types (300-450 chars target), because they synthesize two perspectives. Short, generic replies (under 200 chars) are a red flag that cross-pollination isn't actually happening.
- **Source B window**: Source B posts can come from the last 3 days of daily_posts.json, not just today. This gives a wider pool of perspectives to draw from.

**Layer B — Environment_User's own history:**
- Cross-reference with own_posts.jsonl (last 7 days) for the Environment_User's previous takes on this topic
- If the Environment_User has already posted on this topic, the reply should extend/evolve their established position — not repeat it
- Use the Environment_User's prior framing as a foundation to build on

**Layer C — Research-informed angles (from Tavily enrichment in Step 3):**
- Use data points, protocol developments, or market context discovered via Tavily
- These provide the factual backbone for any angle type

**Angle types** (choose the best fit from the combined source layers):
  - **Contrarian**: Challenge the post's premise with data or alternative framing
  - **Extension**: Build on the post's point with deeper analysis or adjacent insight
  - **Practical**: Share personal experience or workflow that validates/complicates the point
  - **Data-driven**: Add specific numbers, metrics, or on-chain data the original missed
  - **Cross-pollinated**: Synthesize Source B's take with your own perspective for a novel reply to Source A
  - **Question**: Ask a pointed question that demonstrates expertise

**Daily mix target**: Across all replies generated in a single run, aim for this distribution:
  - **~70% cross-pollinated** (take insights from one creator/project and apply them strategically when replying to another — this is the primary value-add. Rework Source B's framing with Environment_User's own perspective, never copy-cat)
  - **~20% own-perspective** (drawn from Environment_User's history and established positions)
  - **~10% research-informed** (creative angles from Tavily enrichment and knowledge base)
  - Cross-pollinated is the BULK of output — the system's core competitive advantage is synthesizing perspectives across creators. Own-perspective and research fill gaps where cross-pollination doesn't apply.
  - These are targets, not hard rules — quality always trumps quota, but consistently falling below 60% cross-pollinated should trigger a review of theme overlap and convergence detection

Choose the angle that best matches the Environment_User's voice profile strengths (loaded from account_profile.md Section 3)

**Step 5 — Confidence scoring:**
- Score each post-angle pair on a 1-10 scale:
  - **Topic relevance** (weight: 30%): How closely does this match the Environment_User's domain?
  - **Engagement potential** (weight: 25%): Will a reply here get visibility? (signal_strength of original post matters)
  - **Value-add quality** (weight: 25%): How much genuine insight can the Environment_User contribute?
  - **Voice fit** (weight: 20%): How naturally does the angle fit the Environment_User's established tone?
- Formula: `confidence = (topic_relevance × 0.3) + (engagement_potential × 0.25) + (value_add × 0.25) + (voice_fit × 0.2)`
- Round to nearest integer

### 1.3 Deduplication

If the same `post_id` appears in multiple themes (possible when convergence_flag is true):
- Analyze the post ONCE
- Generate ONE reply
- Link the reply to all themes where the post appears
- In the xlsx output, list under the highest-signal theme only (avoid duplicate rows)

### 1.4 Output

After processing all themes, you should have:
- A list of posts to engage with, each with: post data, selected angle, confidence score, Tavily context (if any)
- A list of skipped posts with skip reason (off-topic theme, duplicate angle, recent own-post overlap)
- Theme-level stats: posts analyzed per theme, average confidence per theme

**MINIMUM OUTPUT TARGET: 20 replies per daily run.** If fewer than 20 posts are available after theme filtering, generate replies for ALL available posts. If input from Agent ② consistently yields fewer than 20 processable posts, flag in the completion report: "Input volume below target — recommend increasing Agent ② Mode A themes or Mode B post limits."

---

## 2. Engagement Reply Generation

### 2.1 Reply Writing Process

For each post-angle pair from Section 1 (process in confidence descending order):

**Step 1 — Draft reply:**
- Write the reply using the voice reference object loaded in Section 0c from `account_profile.md` Section 3
- **DO NOT hardcode voice rules in these agent instructions** — voice rules are instance-specific and live entirely in the account profile. Different Environment_Users will have different voice profiles. Always load and apply dynamically.
- Apply all personality traits, tone spectrum, vocabulary preferences, and rhythm patterns from the profile
- Length: 100-280 chars is the sweet spot. Can go longer for complex topics but break into short lines (adjust based on Environment_User's brevity preference score from profile). **HARD CAP: 500 chars maximum.** If a reply exceeds 500 chars, trim or split the weakest sentence.
- The reply must add genuine value — never hollow agreement ("great point!") or generic praise

**Step 2 — CTA evaluation:**
- Check CTA rules from Section 0c:
  - Confidence score must be ≥ 7
  - Post topic must directly match a CTA's context rule
  - Frequency cap: max 1 CTA per 5 engagement replies (count across the entire daily output)
  - Never include CTAs in: disagreement replies, pure technical corrections, condolence/support replies
- If CTA qualifies: weave it naturally into the reply text. Never append as a separate sentence.
- Track: `cta_included` (Yes/No), `cta_type` (which CTA was used)

**Step 3 — Quality check (pre-humanizer):**
- Does the reply read naturally in the Environment_User's voice?
- Does it add genuine value or is it hollow?
- Is the CTA (if present) organic or forced?
- Is the length appropriate for the platform?
- Would this reply trigger algorithmic distribution? (replies are 27x more valuable than likes — reference `x-mastery` skill)
- **Cross-pollination validation**: For every reply tagged `angle_source: cross-pollinated`, verify: (a) you can identify a specific Source B post by a different creator, (b) the reply synthesizes Source B's insight rather than just adding generic knowledge base facts, (c) the reply is at least 250 chars (short generic replies fail cross-pollination). If any check fails, reclassify as own-perspective or research-informed.

### 2.2 Humanizer Pass (MANDATORY)

> **This step is non-negotiable.** Every single piece of generated copy must pass through the humanizer before output.

After all replies are drafted:

1. Invoke the `humanizer` skill on ALL reply copies as a batch
2. The humanizer checks for and removes signs of AI-generated writing:
   - Inflated symbolism, promotional language
   - Excessive conjunctive phrases ("furthermore", "moreover", "additionally")
   - Rule of three patterns
   - AI vocabulary words ("delve", "landscape", "navigate", "leverage", "robust")
   - **Em dashes ("—"): ZERO TOLERANCE** — replace every em dash with a comma, period, or line break. Em dashes are the #1 AI writing tell. No em dashes in any output, ever.
   - Vague attributions ("experts say", "many believe")
3. After humanizer pass, verify each reply still:
   - Matches the Environment_User's voice (humanizer should preserve voice, not flatten it)
   - Contains the intended angle and value-add
   - Has CTA intact (if included)
4. If any reply fails post-humanizer voice check, rewrite manually in voice and re-run humanizer

### 2.3 Output

After this section, you have:
- A finalized list of reply copies, each with: post reference, angle description, reply text (humanized), confidence score, CTA status
- These feed directly into the xlsx output (Section 4)

---

## 3. Own-Post Recommendations

### 3.1 Theme Selection

From today's data, identify the top 3 themes for the Environment_User to post about organically. Selection criteria:

1. **Signal strength** — themes with the highest composite signal scores
2. **Convergence priority** — convergence themes (appearing in both Mode A topics + Mode B thought leaders) get priority
3. **Coverage gap** — themes the Environment_User hasn't posted about in the last 7 days (cross-reference with own_posts.jsonl) get a boost
4. **Topic fit** — themes that directly match the Environment_User's profile topics score higher
5. **Timeliness** — breaking developments or rapidly growing narratives score higher

Weighting: `rec_score = (signal × 0.25) + (convergence × 0.2) + (coverage_gap × 0.2) + (topic_fit × 0.2) + (timeliness × 0.15)`

For convergence: +2 if convergence_flag is true, 0 otherwise.
For coverage_gap: +2 if Environment_User hasn't posted on this topic in 7 days, +1 if >3 days, 0 if recent.

### 3.2 Per-Theme Recommendation

For each of the top 3 themes:

**Step 1 — Context research (MANDATORY Tavily enrichment):**
- Use web3 knowledge base for baseline context
- ALWAYS call Tavily to enrich understanding of the theme — this is not optional
- Use `tavily_search` or `tavily_research` to gather latest developments, community sentiment, data points, and emerging angles on the theme
- Budget: max 5 Tavily queries per own-post recommendation (across search + research calls)
- Identify 2-3 supporting data points the Environment_User can reference in their post

**Step 1b — Cross-pollinated insight sourcing (MANDATORY for at least 2 of 3 recs):**
- Scan today's daily_posts.json for insights from creators/projects that relate to this theme
- The own-post recommendation should synthesize perspectives from multiple creators into the Environment_User's unique angle — never just rehash what one creator said
- The Environment_User must ADD their own research-backed perspective on top of the cross-pollinated insight. The post should feel like: "here's what's happening [cross-pollinated observation] + here's what I think it means [own research/analysis]"
- NEVER copy-cat another creator's framing. Take the underlying dynamic they identified, then recontextualize it through the Environment_User's lens (risk decomposition, yield analysis, tooling perspective)
- At most 1 of 3 recs can be purely own-perspective or research-driven. The other 2+ must be cross-pollinated.

**Step 2 — Draft post copy:**
- Write in the Environment_User's voice (same voice rules as Section 2.1)
- Format: standalone tweet OR thread opener (based on Environment_User's thread frequency — "occasional threads for deep analysis; most posts are standalone")
- Structure: short punchy lines with heavy line breaks, escalating structure for exciting topics
- Include concrete data points or examples — never vague generalities
- If cross-pollinated: cite the underlying dynamic, not the source creator (avoid "@so-and-so said X" framing)

**Step 3 — Timing analysis:**
- If data suggests a time window (e.g., theme is peaking in engagement), note the recommended timing
- Otherwise: "No timing signal detected"

**Step 4 — Humanizer pass:**
- Run ALL draft post copies through the `humanizer` skill
- Same verification process as Section 2.2

---

## 4. Output Files

### 4.1 engagement_replies.xlsx

**File**: `account_data/output/engagement_replies.xlsx`
**Mode**: Append-only — new rows added per run, never overwrite existing rows
**Skill**: Use the `xlsx` skill to create/append

**Column order (20 columns, exact order from `data_schema_map.md` Section 4.4):**

| # | Column Header | Source |
|---|--------------|--------|
| 1 | Date | Today's date (YYYY-MM-DD) |
| 2 | Theme | `theme_label` from daily_posts.json |
| 3 | Source | `source_mode` ("topics" / "thought-leaders") |
| 4 | Original Post URL | `url` from post object |
| 5 | Author | `author_handle` from post object |
| 6 | Author Followers | `author_followers` from post object |
| 7 | Post Text | `text` from post object |
| 8 | Views | `views` from post object |
| 9 | Likes | `likes` from post object |
| 10 | Replies | `replies` from post object |
| 11 | Retweets | `retweets` from post object |
| 12 | Suggested Angle | Angle description from Section 1 |
| 13 | Reply Copy | Humanized reply text from Section 2 |
| 14 | Confidence Score | Integer 1-10 from Section 1 |
| 15 | CTA Included | "Yes" / "No" |
| 16 | CTA Type | Which CTA was used, or empty if none |
| 17 | Convergence | "Yes" / "No" (from `convergence_flag`) |
| 18 | Signal Strength | Theme signal score (0-10) |
| 19 | Post ID | `post_id` from the original post object (enables Agent ④ reply adoption tracking) |
| 20 | Angle Source Mix | "cross-pollinated" / "own-perspective" / "research-informed" (tracks distribution against 70/20/10 target) |

**Append rules:**
- If file exists: read existing rows, append new rows after last row
- If file doesn't exist: create with header row + new data rows
- Sort new rows by confidence score descending before appending
- Never modify or delete existing rows from previous days

### 4.2 own_post_recs.xlsx

**File**: `account_data/output/own_post_recs.xlsx`
**Mode**: Append-only — new rows added per run, never overwrite existing rows (same pattern as engagement_replies.xlsx)
**Skill**: Use the `xlsx` skill to create/append

> **CHANGED (2026-03-05)**: Migrated from `own_post_recs.md` (markdown) to `own_post_recs.xlsx` (spreadsheet) for consistency with engagement_replies.xlsx and easier user review.

**Column order (12 columns, exact order from `data_schema_map.md` Section 4.5):**

| # | Column Header | Source |
|---|--------------|--------|
| 1 | Date | Today's date (YYYY-MM-DD) |
| 2 | Theme | `theme_label` from daily_posts.json |
| 3 | Why Trending | 1-2 sentence explanation with evidence |
| 4 | Signal Strength | Theme signal score (0-10) |
| 5 | Source | `source_mode` ("topics" / "thought-leaders" / "convergence") |
| 6 | Convergence | "Yes" / "No" |
| 7 | Angle Source Mix | "cross-pollinated" / "own-perspective" / "research-informed" |
| 8 | Suggested Post | Draft post copy in Environment_User's voice (humanized) |
| 9 | Supporting Data Points | 2-3 bullet points concatenated with newlines |
| 10 | Recommended Timing | Time window or "No timing signal detected" |
| 11 | Coverage Gap Days | Days since Environment_User last posted on this topic (integer) |
| 12 | Rec Score | Computed recommendation score from Section 3.1 weighting |

**Append rules:**
- If file exists: read existing rows, append new rows after last row
- If file doesn't exist: create with header row + new data rows
- Sort new rows by Rec Score descending before appending
- Never modify or delete existing rows from previous days

**Archive**: Pre-flight check #4 now archives `own_post_recs.xlsx` (not .md) to `weekly/own_post_recs_archive/YYYY-MM-DD_recs.xlsx`

### 4.3 analytics_history.jsonl

**File**: `account_data/analytics/analytics_history.jsonl`
**Mode**: Append-only — one JSON object per line, one line per daily run
**Schema**: See `data_schema_map.md` Section 4.3

**Record construction:**

```json
{
  "date": "YYYY-MM-DD",
  "account": "{handle}",
  "run_timestamp": "ISO 8601 (completion time)",
  "themes_analysed": <int>,
  "posts_processed": <int>,
  "themes": [
    {
      "name": "<theme_label>",
      "signal_strength": <0-10>,
      "posts_count": <int>,
      "source_mode": "topics | thought-leaders",
      "top_angle": "<best engagement angle identified>",
      "tavily_research_used": <bool>,
      "replies_written": <int>,
      "avg_theme_confidence": <1-10>,
      "convergence_flag": <bool>
    }
  ],
  "replies_generated": <int>,
  "avg_confidence": <1-10>,
  "ctas_included": <int>,
  "own_post_recs": 3,
  "keywords_that_performed": ["<keyword combos that returned high-signal posts>"],
  "keywords_with_no_signal": ["<keyword combos that returned noise>"],
  "narrative_shifts_detected": ["<free-text observations>"],
  "convergence_themes": ["<themes with convergence_flag: true>"],
  "tavily_researches_run": <int>,
  "own_posts_context_window": <int>,
  "angle_distribution": {
    "cross_pollinated": <int>,
    "own_perspective": <int>,
    "research_informed": <int>,
    "cross_pollinated_pct": <float>,
    "own_perspective_pct": <float>,
    "research_informed_pct": <float>
  }
}
```

**Keyword performance tracking:**
- `keywords_that_performed`: keyword combos from account profile that appeared in themes with signal_strength ≥ 6
- `keywords_with_no_signal`: keyword combos that either returned no posts or only posts with signal_strength < 3
- This data feeds Agent ④'s keyword performance review

**Append rules:**
- Read last line of file, verify it's not today's date (prevent double-writes)
- If today's record already exists: abort with warning "Analytics already run for today"
- Append exactly one line (no trailing newline between records, one newline at end of line)

### 4.4 Post-Write Validation

After all 3 output files are written, validate:

| File | Check | On Failure |
|------|-------|-----------|
| `analytics_history.jsonl` | Last line is valid JSON; has today's date; all required fields present per schema | ROLLBACK — remove last line, alert user |
| `engagement_replies.xlsx` | New rows have all 20 columns; no empty Reply Copy cells | WARN — flag incomplete rows for review |
| `own_post_recs.xlsx` | New rows have all 12 columns; no empty Suggested Post cells; sorted by Rec Score descending | WARN — flag incomplete rows in completion report |

---

## 5. Completion Report

Write completion report to `account_data/logs/agent_3_log.txt`.

**Format:**

```
=== Agent ③ Analytics & Content — {YYYY-MM-DD} ===

Run timestamp: {ISO 8601}
Account: @{handle}

--- INPUT SUMMARY ---
Daily posts loaded: {n} posts across {n} themes
Own posts context: {n} posts (last 7 days)
Web3 KB: {loaded / missing}
Analytics history: {n} days loaded / not available

--- PROCESSING ---
Themes analysed: {n}
Themes skipped (off-topic): {n}
Posts analysed: {n}
Tavily research calls: {n} / 5 budget
Kaito calls: {n} (if used)

--- OUTPUT ---
Replies generated: {n}
Average confidence: {x.x}
CTAs included: {n} / {total replies}
Own-post recommendations: 3

--- FILES WRITTEN ---
engagement_replies.xlsx: {n} new rows appended (total rows: {n})
own_post_recs.xlsx: {n} new rows appended (total rows: {n}, archived previous to {archive_path})
analytics_history.jsonl: 1 record appended

--- VALIDATION ---
analytics_history.jsonl: {PASS / FAIL — details}
engagement_replies.xlsx: {PASS / FAIL — details}
own_post_recs.xlsx: {PASS / FAIL — details}

--- KEYWORD PERFORMANCE ---
High-signal combos: {list}
No-signal combos: {list}
Narrative shifts: {list}

--- ANGLE DISTRIBUTION ---
Cross-pollinated: {n}/{total} ({pct}%)
Own-perspective: {n}/{total} ({pct}%)
Research-informed: {n}/{total} ({pct}%)
Target: 70/20/10 (cross-pollinated/own/research)

--- NOTES ---
{operational observations — e.g., data quality issues from Agent ②, themes skipped with reasons, 1-post theme handling}

--- ERRORS ---
{error details or "None"}

--- NEXT AGENT STATUS ---
Agent ④ input ready: {Yes / No — analytics_history has {n} records in last 7 days}
```

> **IMPORTANT**: The log file must NOT start with a blank line. The very first character must be `=` (the start of the header). No leading whitespace or newlines.

---

## 6. Error Handling & Recovery

| Scenario | Detection | Action |
|----------|-----------|--------|
| **No fresh daily_posts.json** | Pre-flight check #1 fails (no today key or timestamp > 24h) | ABORT — log error: "No fresh daily_posts for today (last pull: {timestamp}). Run Agent ② first." |
| **Missing account profile** | Pre-flight check #2 fails | ABORT — log error: "Account profile missing or incomplete for @{handle}" |
| **Missing web3 KB** | Pre-flight check #3 fails | WARN — continue with reduced context. Note in completion report. |
| **Tavily error** | `tavily_search` or `tavily_research` returns error | Log warning, skip enrichment for that theme, continue. Decrement Tavily budget. |
| **Tavily budget exhausted** | 10 Tavily calls already made for this run | Skip remaining Tavily enrichment. Note in completion report. |
| **Kaito error** | `kaito_engagement` returns error | Log info: "Kaito unavailable, proceeding without smart engagement signal." |
| **xlsx write failure** | openpyxl or xlsx skill fails | CRITICAL — log error, save reply data as CSV fallback to `engagement_replies_fallback.csv` |
| **Double-run detected** | analytics_history.jsonl already has today's date | ABORT — log warning: "Analytics already run for today. Skipping." |
| **Humanizer skill unavailable** | Skill not loaded or fails | WARN — output unhomogenized copy with note in completion report: "Humanizer unavailable — copy NOT humanized. Review manually." |
| **own_post_recs.xlsx archive fails** | Copy to archive fails (dir missing, permissions) | Create directory if missing, retry. If still fails: WARN — append without archiving, note data loss risk in completion report. |

---

## 7. Skills Reference

| Skill | Purpose | When Used |
|-------|---------|-----------|
| `humanizer` | Remove AI writing patterns from all generated copy | **MANDATORY** — Section 2.2 (replies), Section 3.2 (own post recs) |
| `brand-voice-extractor` | Reference for voice matching verification | Section 2.1 (voice reference during reply writing) |
| `twitter-algorithm-optimizer` | Optimize reply structure for algorithmic distribution | Section 2.1 (reply drafting — structure for visibility) |
| `x-mastery` | Engagement weight reference (replies 27x likes) | Section 1.2 (confidence scoring — engagement potential) |
| `marketing:content-creation` | CTA framework patterns | Section 2.1 (CTA evaluation and natural weaving) |
| `web3-research` | Protocol and narrative context | Section 1.2 (theme assessment — web3 context cross-reference) |
| `xlsx` | Spreadsheet creation and append | Section 4.1 (engagement_replies.xlsx output) |

### 7.1 Typefully Draft Push

After generating `engagement_replies.xlsx`, push today's replies to Typefully as drafts:

1. Get `social_set_id` from Typefully (`list_social_sets`)
2. **CONFIDENCE FLOOR**: Filter out replies with confidence < 6 before pushing. These remain in `engagement_replies.xlsx` for manual review but are NOT pushed to Typefully. Log: "Filtered {n} replies below confidence floor (< 6) — kept in xlsx only"
3. **URL VALIDATION (MANDATORY before any draft creation):** For each reply, extract the `post_id` from the `reply_to_url` (the numeric ID at the end of the URL). Cross-reference EVERY `post_id` against `daily_posts.json` (today + last 2 days). The post_id MUST exist as a `post_id` field in a post object within `daily_posts.json`. If a post_id is NOT found in daily_posts.json, do NOT create the Typefully draft — instead flag it in the completion log as "INVALID URL: {url} — post_id not found in daily_posts.json". This prevents fabricated/hallucinated tweet URLs from being pushed to Typefully. **Never construct tweet URLs from memory or inference — always source them directly from the `url` field in daily_posts.json post objects.**
4. For each validated reply row from today with confidence ≥ 6: create a Typefully draft with the reply text on X platform, using `reply_to_url` set to the Original Post URL from daily_posts.json (not from any intermediate script output)
5. **RATE LIMIT HANDLING**: Typefully API enforces strict rate limits (~19 draft creations per burst). On first 429 response, save remaining drafts to `account_data/output/unpushed_typefully_drafts.json` and **wait 4 hours** before retrying. After the 4-hour wait, resume pushing from the unpushed file. If still limited after the retry, save again and stop.
6. Sort by confidence score descending (push highest confidence first, so if rate limit hits, the best replies are already in Typefully)
7. Report how many drafts were created, how many filtered by confidence floor, how many rate-limited, and how many were flagged as invalid URLs, in the completion log

### 7.2 Kaito Integration (Optional Enhancement)

If Kaito connector is available (check `CLAUDE.md` Section 2.1):

- **`kaito_engagement`**: Call for the top 5 posts by confidence score to get smart engagement metrics (Environment_User engagement vs. general engagement). Posts with high smart engagement → boost confidence by +1.
- **Budget**: Count against daily 80-call Kaito limit (shared with all agents).
- **If unavailable**: Skip entirely — Kaito is enhancement only, never required.
