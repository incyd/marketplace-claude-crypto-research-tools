> **v3.1 Execution Model**: This agent runs as an isolated subagent spawned by the
> daily orchestrator via the Cowork Agent tool. It receives its own context window
> and does NOT share session state with other agents.
>
> **Spawned by**: `orchestrators/daily-pipeline.md`
> **Primary source**: This file is the runtime source of truth. `config/agent_daily_pull.md` is archive only.

# Agent ② — Daily Data Pull Agent Configuration

> **Model**: Sonnet 4.6
> **Trigger**: Daily (scheduled task)
> **Purpose**: Fetch posts from X in 3 modes (topics, thought-leaders, own posts), normalize to canonical schema, append to data files.
> **Output**: `account_data/data/daily_posts.json` (append date key), `account_data/data/own_posts.jsonl` (append lines)
>
> **Runtime**: Read `CLAUDE.md` Section 2 for connector IDs before making any MCP calls.

---

## 0. Load Context & Pre-Flight Checks

> This section mirrors `CLAUDE.md` Section 1.4 (Context Manifest) for Agent ②. If there is ever a conflict, `CLAUDE.md` Section 1.4 wins.

### 0a. Load Context (in this order)

| # | File | What to Read | Category |
|---|------|-------------|----------|
| 1 | `CLAUDE.md` | **Full file** — system rules, connector IDs (Section 2.1), tool matrix (Section 2.2), rate limits (Section 2.3), file ownership (Section 3) | ESSENTIAL |
| 2 | _(this file)_ `agents/agent-daily-pull.md` | **Full file** — you're already here | ESSENTIAL |
| 3 | `config/mcp_setup_guide.md` | Section 5 (Tool Reference), Section 6 (Decision Tree), Section 7 (Troubleshooting) | REFERENCE |
| 4 | `account_data/profile/account_profile.md` | Topics + keyword combos (Mode A), thought-leader list (Mode B), Environment_User handle (Mode C) | ESSENTIAL |
| 5 | `templates/data_schema_map.md` | Section 3 (Canonical Post Schema), Section 3.1 (Normalization Map), Section 4.1 (`daily_posts.json` structure), Section 4.2 (`own_posts.jsonl` structure) | ESSENTIAL |
| 6 | `account_data/data/daily_posts.json` | Last date key only — check if today's data already exists (dedup) | DATA |
| 7 | `account_data/data/own_posts.jsonl` | Last 10 lines — recent post_ids for dedup before appending | DATA |

### 0b. Pre-Flight Checks

1. **Verify CLAUDE.md is populated**: Check Section 2.1 connector ID mapping. If empty, abort → user must run `/setup` first.
2. **Verify account profile exists**: `account_data/profile/account_profile.md` must exist with non-empty `keyword_combos` and `thought_leaders` sections. If missing/corrupt, abort with error: "Cannot run daily pull without a complete account profile. Run `/onboard @{handle}` first."
3. **Check for duplicate pull**: If today's date key already exists in `daily_posts.json`, warn: "Today's data already pulled. Re-pulling will append duplicate data. Continue? (y/n)"
4. **Verify data files exist**: `daily_posts.json` and `own_posts.jsonl` must already exist (created by `/setup`). If missing, abort with error: "Data files not initialized. Run `/setup` first."
5. **Check for dormant keywords**: Scan `agent_2_log.txt` for any keyword combos marked `DORMANT` (3+ consecutive days of 0 results). Skip dormant combos during Mode A to avoid wasting Kaito budget on known-dead searches. Log: "Skipping {n} dormant keywords: {list}"
6. **Record start time**: Capture the current timestamp for the `pull_timestamp` field. Format: `YYYY-MM-DDTHH:MM:SSZ` (clean ISO 8601 with Z suffix, no microseconds, no `+00:00` offset). Record this BEFORE the first API call so Duration reflects actual wall-clock time including API roundtrips.

---

## 1. Mode A — Topics Pull (Kaito-First: `kaito_advanced_search` + `get_tweet_thread`)

### 1.1 Purpose

Find high-signal posts about topics the Environment_User cares about using a 3-tier search strategy. **Primary**: Kaito `kaito_advanced_search` for discovery (filters org spam, provides smart_engagement signal), then Connector B `get_tweet_thread` for full tweet copy. **Fallback 1**: Connector B `search_tweets`. **Fallback 2 (last resort)**: Connector A `search_x` (expensive — avoid unless both primary and fallback 1 fail).

### 1.2 Input

Read `account_data/profile/account_profile.md` Section 2 (Topics). Extract all validated keyword combos from each topic.

Example for @incyd__:
- Topic 1 (DeFi Yields): `defi yields`, `vault strategy`, `aave leverage`, `eth staking`, `impermanent loss`, `defi risk`, `yield tranching`, `morpho lending`, `morpho infrastructure`, `vault risk transparency`
- Topic 2 (AI Agents): `claude agent crypto`, `ai yield optimization`, `ai defi`, `crypto research agent`, `claude skills`
- Topic 3 (RWA): `tokenized gold`, `gold vault`, `rwa collateral`, `gold onchain`, `paxg xaut`
- Topic 4 (DeFi Risk): `defi risk`, `leverage liquidation`, `effective leverage`, `protocol risk`

### 1.3 Execution Algorithm

```
BUDGET: max 10 keyword combos per daily run (shared across all tiers)
KAITO BUDGET: ~6-10 kaito_advanced_search calls (of 80/day shared across all agents — CLAUDE.md Section 2.3)
PRIMARY: Kaito kaito_advanced_search → extract tweet IDs → Connector B get_tweet_thread
FALLBACK 1: Connector B search_tweets (if Kaito unavailable)
FALLBACK 2: Connector A search_x (LAST RESORT — expensive)

1. Deduplicate keyword combos across topics
   - Some combos appear in multiple topics (e.g., "defi risk" in Topics 1 and 4)
   - Deduplicate → unique combos list

2. Prioritize combos for today's pull
   - If total unique combos > 10, rotate:
     * Always include top 2 combos from each topic (by historical signal strength)
     * Rotate remaining combos on a daily basis (modulo day-of-year)
   - If total unique combos ≤ 10, use all of them

3. For each selected keyword combo (up to 10):

   PRIMARY — Kaito + Connector B:
   Step A — Kaito discovery:
   call: kaito_advanced_search(
     keyword: "{keyword_combo}",
     author_type: "Individual",
     sort_by: "engagement",
     sources: "Twitter",
     min_created_at: "{24h_ago_ISO}",
     size: 20
   )
   connector: Kaito (ID from CLAUDE.md Section 2.1)

   IMPORTANT PARAMETERS:
   - author_type: "Individual" → eliminates org/project spam at source
   - sort_by: "engagement" → highest-signal results first
   - sources: "Twitter" → Twitter only (no News)
   - min_created_at: 24h rolling window (ISO 8601 timestamp)
   - size: 20 → sufficient for 24h window; no pagination needed

   - Track Kaito call count across the run. Before each call, verify cumulative daily Kaito usage < 80.
   - If Kaito returns an error or is rate-limited:
     → Switch to FALLBACK 1 for remaining combos (see 1.3.1)
   - If a call returns 0 results: log and move to next combo (not an error).

   Step B — Extract tweet IDs from Kaito URLs:
   For each Kaito result, extract the tweet ID from the URL:
   - URL format: "https://twitter.com/{user_id}/status/{tweet_id}"
   - Extraction: regex /status/(\d+) → capture group 1 = tweet_id
   - Collect: tweet_id, Kaito engagement, Kaito smart_engagement, Kaito summary

   Step C — Pre-filter before Connector B fetch:
   - Dedup by tweet_id across all keyword combos (a tweet found by multiple combos = 1 fetch)
   - Kaito engagement floor: keep tweets with engagement > 0 (configurable)
   - Age check: already handled by min_created_at in Kaito call

   Step D — Fetch full tweets via Connector B:
   For each qualifying tweet_id:
   call: get_tweet_thread(tweetId: "{tweet_id}")
   connector: Connector B (ID from CLAUDE.md Section 2.1)

   - Response is an array of tweets (full thread). Extract ONLY the tweet where tweet.id == target tweet_id
   - Typically the FIRST tweet in the response array, but ALWAYS match by ID
   - Discard all other tweets in the thread response
   - If get_tweet_thread fails for a specific tweet: log error, skip that tweet, continue with others

4. Collect all fetched tweets into a flat list
   - Dedup by post_id across all responses (should already be deduped from Step C, but verify)
   - Filter: exclude posts older than 48 hours (stale content)
   - Filter: exclude posts with views < 100 (noise floor)

5. Tag each tweet with the keyword combo(s) that found it
   - A tweet found by multiple combos gets tagged with ALL matching combos
   - This tag is metadata only — not written to the canonical post object
   - ALSO preserve Kaito smart_engagement per tweet (used for theme prioritization, not written to schema)

6. Noise detection per keyword combo:
   Since author_type: "Individual" already eliminates org spam, noise now means OFF-TOPIC results.
   After filtering (step 4), compute the qualifying ratio for each combo:
     qualifying_ratio = qualifying_posts / raw_posts_returned

   IF qualifying_ratio < 0.20 (fewer than 20% of raw posts survived filtering):
     → Flag this keyword combo as "noisy" in the completion report (Section 6)
     → Log: "⚠️ Keyword '{combo}' noise ratio: {qualifying_ratio}. Recommend replacement."

   IF a keyword combo is flagged as noisy for 3+ consecutive daily runs:
     → Escalate: include in the completion report with REPLACE recommendation
     → The user (or Agent ④ during weekly learning) should replace it in the profile
     → Track noise flags in agent_2_log.txt so they persist across runs

   Common noise patterns to note in the log:
     - Abbreviation collision (e.g., "MCP" = "market cap" on Crypto Twitter)
     - Cross-domain match (e.g., "vault strategy" matching geopolitics accounts)
     - Off-topic keyword collision (check Kaito AI summary for relevance)

   Content gap detection (optional, when Kaito budget allows):
     For high-priority keywords, run a second Kaito call with author_type: "Organization":
     - Compare org volume vs individual volume
     - High org / low individual = content gap = high-ROI opportunity
     - Report in completion log (Section 6)
```

#### 1.3.1 Fallback Tiers for Mode A

```
FALLBACK TIER 1 — Connector B search_tweets:
Trigger: Kaito API is unavailable (all calls fail, rate limited, or returns 0 results across ALL keywords)

call: search_tweets(query: "{keyword_combo}", queryType: "Top")
connector: Connector B (ID from CLAUDE.md Section 2.1)

- Response uses Connector B tweet format (data_schema_map.md Section 2.1)
  → Author metadata (followers, verified) is already inline — no enrichment needed
- No sort parameter — use queryType: "Top" for highest-signal results
- Returns ~20 results per call
- Budget: same 10-combo cap applies
- Normalization: Use Connector B normalization path (Section 2.6)
- Set source_connector: "B" on all Tier 1 fallback results

FALLBACK TIER 2 — Connector A search_x (LAST RESORT):
Trigger: BOTH Kaito AND Connector B search_tweets fail (all calls fail for both)

call: search_x(query: "{keyword_combo}", limit: 20, sort: "impressions")
connector: Connector A (ID from CLAUDE.md Section 2.1)

- Budget: max 10 search_x calls
- HARD LIMIT: Never request more than 20 tweets per search_x call (limit ≤ 20)
- If 402 CreditsDepleted: stop all Connector A calls, proceed with whatever data collected
  → Notify user: "⚠️ Connector A credits depleted."
- Normalization: Use Connector A normalization path (Section 1.5.2)
- Set source_connector: "A" on all Tier 2 fallback results
- ⚠️ Author enrichment REQUIRED for Connector A results (see Section 1.4)

Fallback activation log:
- Log which tier was used for each keyword combo
- Log reason for fallback activation
- Include in completion report (Section 6)
```

### 1.4 Author Enrichment (Connector A fallback posts only)

Author enrichment is **only needed when Tier 2 fallback (Connector A) is activated**. Both the primary Kaito+B path and Tier 1 fallback (Connector B `search_tweets`) provide inline author metadata — no enrichment needed.

```
WHEN CONNECTOR A FALLBACK IS ACTIVE:
1. Collect all unique author handles from Connector A results only
2. Batch-call get_user_info (Connector B) for each unique author
   - Budget: max 5 get_user_info calls for Mode A enrichment
   - If > 5 unique authors, prioritize by number of posts in results
   - If get_user_info fails for an author, default:
     author_followers: 0, author_verified: false
3. Cache author metadata for this run (avoid duplicate get_user_info calls in Mode B)

WHEN PRIMARY (Kaito+B) OR TIER 1 FALLBACK (Connector B search_tweets):
  → Skip this step entirely — Connector B provides inline author data
```

### 1.5 Normalization

#### 1.5.1 Primary Path: Kaito+B Normalization

Normalize every Connector B tweet (fetched via `get_tweet_thread` from Kaito URLs) to the canonical post schema. This uses the **same field mapping as Mode B Section 2.6** (Connector B normalization), with `source_connector: "Kaito+B"`:

```
canonical = {
  post_id:          tweet.id,
  text:             tweet.text,
  author_handle:    tweet.author.userName,
  author_name:      tweet.author.name,
  author_followers:  tweet.author.followers,
  author_verified:  tweet.author.isBlueVerified,
  views:            tweet.viewCount,
  likes:            tweet.likeCount,
  replies:          tweet.replyCount,
  retweets:         tweet.retweetCount,
  quotes:           tweet.quoteCount,
  bookmarks:        tweet.bookmarkCount,
  created_at:       parse_connector_b_date(tweet.createdAt),  // see Section 2.6.1
  url:              tweet.url,
  lang:             tweet.lang,
  is_reply:         tweet.isReply,
  in_reply_to_id:   tweet.inReplyToId || null,
  conversation_id:  tweet.conversationId,
  has_quoted_tweet:  tweet.quoted_tweet != null,
  quoted_post_id:   tweet.quoted_tweet?.id || null,
  is_retweet:       tweet.retweeted_tweet != null,
  source_connector: "Kaito+B",
  pull_date:        today (YYYY-MM-DD)
}
```

> **NOTE**: This is identical to Mode B's Connector B normalization (Section 2.6) except `source_connector` = `"Kaito+B"` instead of `"B"`. All 23 canonical fields are populated from Connector B's `get_tweet_thread` response — no defaults or missing fields.

#### 1.5.2 Tier 1 Fallback: Connector B `search_tweets` Normalization

Same as Section 2.6 (Mode B normalization). Set `source_connector: "B"`.

#### 1.5.3 Tier 2 Fallback: Connector A Normalization

Only used when Connector A `search_x` is the last-resort fallback:

```
canonical = {
  post_id:          tweet.id,
  text:             tweet.text,
  author_handle:    tweet.username,
  author_name:      tweet.name,
  author_followers:  enriched_author.followers || 0,
  author_verified:  enriched_author.isBlueVerified || false,
  views:            tweet.metrics.impressions,
  likes:            tweet.metrics.likes,
  replies:          tweet.metrics.replies,
  retweets:         tweet.metrics.retweets,
  quotes:           tweet.metrics.quotes,
  bookmarks:        tweet.metrics.bookmarks,
  created_at:       tweet.created_at.replace(".000Z", "Z"),  // strip milliseconds
  url:              tweet.tweet_url,                          // NOT tweet.urls[]
  lang:             "en",                                     // default — Connector A doesn't provide
  is_reply:         tweet.conversation_id != tweet.id,
  in_reply_to_id:   null,                                     // not available from Connector A
  conversation_id:  tweet.conversation_id,
  has_quoted_tweet:  false,                                    // not available from Connector A
  quoted_post_id:   null,                                     // not available from Connector A
  is_retweet:       false,                                     // not available from Connector A
  source_connector: "A",
  pull_date:        today (YYYY-MM-DD)
}
```

### 1.6 Signal Scoring

After normalization, compute signal scores for every post:

```
raw_signal = (likes × 1) + (replies × 27) + (retweets × 20) + (quotes × 24) + (bookmarks × 4) + (views × 0.01)
```

Weights from CLAUDE.md Section 4.2 / x-mastery skill analysis.

### 1.7 Theme Clustering

Group normalized, scored posts into themes:

```
1. Cluster posts by semantic similarity of content
   - Use keyword combo tags as a starting signal
   - Posts found by the same combo likely share a theme
   - Posts found by different combos within the same topic may share a broader theme

2. Assign human-readable theme labels
   - Theme label = concise description of the shared topic (e.g., "ETH restaking yield")
   - NOT the keyword combo itself — the label should describe the conversation

   SPECIFICITY RULES (mandatory):
   - Labels MUST reference at least one of: a specific protocol/project name,
     a measurable event/milestone, or a named narrative from the web3 KB.
   - BANNED generic labels: "Crypto general", "Market sentiment", "DeFi ecosystem",
     "Bitcoin & macro", "Blockchain news", "Crypto regulation", or any label that
     could describe 50%+ of all crypto Twitter content on any given day.
   - Test: Would this label help Agent ③ identify a specific engagement angle?
     If the answer is no, the label is too generic — split the cluster or
     merge individual posts into more specific existing themes.
   - Good: "Morpho fixed-rate market launch", "Compound oracle vulnerability",
     "Kraken-Nasdaq tokenized stock partnership"
   - Bad: "DeFi ecosystem", "Market sentiment & trading", "Crypto general"

3. Filter themes:
   - Each theme MUST have 2+ posts to qualify (CLAUDE.md Section 4.3)
   - Single-post themes MUST be handled — never output a theme with only 1 post:
     a. FIRST TRY: Merge the lone post into the most semantically similar existing theme
     b. IF no suitable theme exists (no thematic overlap): drop the post entirely
     c. Log the action: "Merged 1-post theme '{label}' into '{target_theme}'" or "Dropped 1-post theme '{label}'"

4. Select top 7 themes by average signal_strength
   - Within each theme: keep up to 5 posts, sorted by signal score descending
   - Compute theme-level signal_strength: average of post signal scores, normalized 0-10

5. For each theme, record:
   - theme_label: string
   - source_mode: "topics"
   - signal_strength: number (0-10)
   - convergence_flag: false (set later if Mode B has same theme)
   - unique_authors: count of distinct author_handle values
   - posts: array of canonical post objects
```

### 1.8 Mode A Output

Hold Mode A results in memory (do NOT write to file yet). They will be combined with Mode B results before writing.

```
mode_a_themes = [
  { theme_label, source_mode: "topics", signal_strength, convergence_flag: false, unique_authors, posts: [...] },
  ...up to 7 themes
]
```

---

## 2. Mode B — Thought-Leader Timeline Pull (Connector B: `get_user_tweets`)

> **v3.2 — Batched Processing**: Mode B processes TLs in sequential batches of 5 to keep
> per-batch context manageable. Batch count is computed dynamically: `ceil(TL_count / 5)`.
> Each batch pulls, normalizes, scores, and clusters independently. Raw tweet data is
> discarded after each batch — only compact theme objects carry forward. A final merge
> step combines batch themes into the Mode B output.

### 2.1 Purpose

Track what the Environment_User's thought leaders are posting. This surfaces emerging narratives from influential voices the Environment_User respects.

### 2.2 Input

Read `account_data/profile/account_profile.md` Section 4.2 (Thought Leaders to Track). Extract all TL handles.

### 2.3 Batch Assignment

```
BATCH_SIZE = 5  (fixed — do not change without updating context budget estimates)

1. Read all TL handles from profile Section 4.2 → tl_list[]
2. Compute batch count: num_batches = ceil(len(tl_list) / BATCH_SIZE)
3. Assign TLs to batches using round-robin by priority:
   a. Sort tl_list by follower count descending (proxy for signal contribution)
   b. For i in range(len(tl_list)):
        batch_index = i % num_batches
        batches[batch_index].append(tl_list[i])

   This distributes high-follower (high-signal) TLs evenly across batches,
   preventing one batch from being all high-signal and another all low-signal.

4. Log batch assignments:
   "Mode B batches: {num_batches} batches of ~{BATCH_SIZE} TLs"
   For each batch: "Batch {n}: {handle_list}"

Example with 23 TLs → 5 batches (5, 5, 5, 5, 3):
  Batch 1: TL[0], TL[5], TL[10], TL[15], TL[20]
  Batch 2: TL[1], TL[6], TL[11], TL[16], TL[21]
  Batch 3: TL[2], TL[7], TL[12], TL[17], TL[22]
  Batch 4: TL[3], TL[8], TL[13], TL[18]
  Batch 5: TL[4], TL[9], TL[14], TL[19]
```

### 2.4 Per-Batch Execution Algorithm

```
BUDGET: 1 get_user_tweets call per TL. Page 1 only (no pagination).
PER-TL CAP: Keep up to 5 posts per TL after filtering (top 5 by signal_score).
PER-BATCH THEME CAP: max 4 themes per batch (merge step reduces to final 10).
PER-BATCH POST CAP: max 3 posts per theme within a batch.

FOR batch_index IN range(num_batches):
  tl_handles = batches[batch_index]
  batch_posts = []

  # --- STEP 1: PULL ---
  For each TL handle in tl_handles:

    call: get_user_tweets(userName: "{tl_handle}")
    connector: Connector B (ID from CLAUDE.md Section 2.1)

    - Returns ~20 posts (originals, quote tweets, AND pure RTs; no replies)
    - If a call fails (timeout, 500 error, empty response), log and skip that TL
    - DO NOT retry failed calls — move to next TL

  From each response, extract tweets from response.data.tweets[]
    - Filter: exclude posts older than 48 hours (same freshness window as Mode A)
    - Filter: exclude posts with views < 100 (noise floor)
    - Cap: keep top 5 posts per TL by signal_score (if > 5 qualify after filtering)
    - NOTE: get_user_tweets returns originals, QTs, AND pure RTs. Keep all types —
      RTs reveal what TLs find worth amplifying, which is signal in itself.
      Pure RTs can be identified by `retweeted_tweet != null` for downstream analysis.

  Collect qualifying tweets into batch_posts[]
    - Dedup by post_id within batch
    - Tag each tweet with the TL handle that sourced it (metadata only)

  # --- STEP 2: NORMALIZE (Section 2.6) ---
  Normalize all batch_posts to canonical schema.

  # --- STEP 3: SCORE (Section 2.7) ---
  Compute signal scores for all normalized batch posts.

  # --- STEP 4: CLUSTER ---
  Cluster batch posts into themes using Section 1.7 algorithm with these overrides:
    - max_themes: 4 (not 10 — budget is split across batches)
    - max_posts_per_theme: 3
    - source_mode: "thought-leaders"
    - Theme label specificity rules from Section 1.7 step 2 apply equally here.

  # --- STEP 5: COMPACT ---
  Store batch themes in all_batch_themes[].
  DISCARD all raw tweet data, normalized posts, and scored posts for this batch.
  Only the compact theme objects (label + signal + posts array) carry forward.

  Log: "Batch {batch_index+1}/{num_batches}: {len(tl_handles)} TLs,
        {len(batch_posts)} posts after filter, {len(batch_themes)} themes"

  # Context now holds: agent spec (static) + Mode A themes + previous batch
  # themes (compact) — ready for next batch without context pressure.
```

### 2.5 Theme Merge Algorithm

After all batches complete, merge batch-level themes into the final Mode B output:

```
INPUT: all_batch_themes (up to 4 × num_batches themes)

STEP 1 — Cross-batch dedup:
  Compare theme labels across batches for semantic overlap.
  Two themes from different batches are DUPLICATES if ANY of:
    (a) 2+ shared author handles in their post lists, OR
    (b) Same protocol/project name appears in both theme labels, OR
    (c) Posts in both themes share a conversationId (same Twitter thread)

  IF duplicate found:
    → MERGE: combine post lists, average signal_strength, union unique_authors
    → Use the more specific theme label
    → Cap merged theme at 3 posts (top by signal_score)

STEP 2 — Re-apply singleton rule:
  After merge, any theme with only 1 post:
    → Try to merge into closest existing multi-post theme
    → If no match, drop

STEP 3 — Select top 10:
  Sort all remaining themes by signal_strength descending.
  Keep top 10 themes.
  Verify total posts ≤ 30 (cap at 3 per theme).

STEP 4 — Re-label if needed:
  Merged themes may need label updates to reflect combined content.
  Apply same specificity rules from Section 1.7 step 2.
  Mode B themes referencing multiple TLs should use the shared topic, not
  a generic category (e.g., "Morpho institutional lending — TheDeFinvestor,
  DeFi_Dad" not "DeFi lending").

OUTPUT: mode_b_themes (up to 10, same schema as Section 2.10)

Log: "Merge: {pre_merge_count} batch themes → {post_merge_count} after dedup →
      {final_count} final themes, {total_posts} total posts"
```

### 2.6 Normalization

Normalize every Connector B tweet to the canonical post schema using `data_schema_map.md` Section 3.1:

```
canonical = {
  post_id:          tweet.id,
  text:             tweet.text,
  author_handle:    tweet.author.userName,
  author_name:      tweet.author.name,
  author_followers:  tweet.author.followers,
  author_verified:  tweet.author.isBlueVerified,
  views:            tweet.viewCount,
  likes:            tweet.likeCount,
  replies:          tweet.replyCount,
  retweets:         tweet.retweetCount,
  quotes:           tweet.quoteCount,
  bookmarks:        tweet.bookmarkCount,
  created_at:       parse_connector_b_date(tweet.createdAt),  // see 2.6.1
  url:              tweet.url,
  lang:             tweet.lang,
  is_reply:         tweet.isReply,
  in_reply_to_id:   tweet.inReplyToId || null,
  conversation_id:  tweet.conversationId,
  has_quoted_tweet:  tweet.quoted_tweet != null,
  quoted_post_id:   tweet.quoted_tweet?.id || null,
  is_retweet:       tweet.retweeted_tweet != null,
  source_connector: "B",
  pull_date:        today (YYYY-MM-DD)
}
```

#### 2.6.1 Date Parsing — Connector B

Connector B `createdAt` format: `"Sat Feb 28 18:44:17 +0000 2026"`

Parse to ISO 8601: `"2026-02-28T18:44:17Z"`

Parsing steps:
1. Split string by spaces → `["Sat", "Feb", "28", "18:44:17", "+0000", "2026"]`
2. Map month abbreviation → number: Jan=01, Feb=02, ..., Dec=12
3. Assemble: `"{year}-{month}-{day}T{time}Z"`

### 2.7 Signal Scoring

Same formula as Mode A (Section 1.6). Apply to all Mode B posts (within each batch).

### 2.8 Author Metadata

Connector B `get_user_tweets` responses already include the `author` object with `followers` and `isBlueVerified`. No additional enrichment needed for Mode B posts.

However, check the author cache from Mode A enrichment — if any TL author was already looked up, reuse that data rather than making redundant calls.

### 2.9 Convergence Detection

> **Timing**: Convergence runs AFTER the theme merge step (Section 2.5), NOT after
> per-batch clustering. The merge produces the final `mode_b_themes`, which is what
> gets compared against Mode A themes.

After Mode B merge, cross-reference with Mode A themes:

```
For each Mode B theme (from merge output):
  For each Mode A theme:
    IF theme topics substantially overlap — defined as meeting AT LEAST ONE of:
      (a) 1+ shared keyword combo from the account profile, OR
      (b) 2+ shared author handles across both theme post sets, OR
      (c) explicit shared protocol/project name in both theme labels
    AND combined unique_authors across both ≥ 3:
      Set convergence_flag = true on BOTH the Mode A and Mode B theme

Convergence means: the Environment_User's topic interest (Mode A) is being
actively discussed by their thought leaders (Mode B) — this is a high-signal
engagement opportunity.

VALIDATION GATE (mandatory — run AFTER all convergence flags are set):
  1. Count total convergent themes vs total themes.
  2. If convergence ratio > 50%: detection was too loose.
     Re-run convergence with STRICTER matching:
       require (a) 2+ shared keyword combos OR (b) 3+ shared author handles.
  3. Log convergence ratio in completion report:
     "Convergence: {n}/{total} themes ({pct}%)"
  4. If ratio > 50% AFTER re-run: flag WARNING in agent_2_log:
     "Convergence ratio {pct}% exceeds 50% ceiling after strict re-run.
      Review theme clustering quality — themes may be too broad."
```

### 2.10 Mode B Output

Hold Mode B results in memory alongside Mode A results.

```
mode_b_themes = [
  { theme_label, source_mode: "thought-leaders", signal_strength, convergence_flag, unique_authors, posts: [...] },
  ...up to 10 themes
]
```

---

## 3. Mode C — Own Posts Pull (Connector B: `get_user_tweets`)

> **IMPORTANT**: Mode C pulls **the Environment_User's own tweets** — i.e., the account this instance manages. For the @incyd__ instance, this pulls @incyd__'s tweets, NOT thought-leader tweets (that's Mode B). Mode C exists so Agent ③ can maintain narrative continuity with what the Environment_User has already posted, and so Agent ④ can compare proposed content against actual posting behavior.

### 3.1 Purpose

Track the Environment_User's own recent posting activity — the tweets published by the Environment_User this instance is configured for (the handle in `account_data/profile/account_profile.md` Section 1). This feeds into Agent ③ for narrative continuity and Agent ④ for proposed-vs-actual comparison.

### 3.2 Input

Environment_User's own handle from `account_data/profile/account_profile.md` Section 1 (Account Overview). This is the Environment_User's handle — NOT any thought leader.

### 3.3 Execution Algorithm

```
1. Call get_user_tweets for the Environment_User's OWN handle (the Environment_User's account):

   call: get_user_tweets(userName: "{environment_user_handle}")
   connector: Connector B (ID from CLAUDE.md Section 2.1)

   Example: For the @incyd__ instance → get_user_tweets(userName: "incyd__")

   - Returns ~20 most recent posts (originals, quote tweets, AND pure RTs; no replies)
   - Page 1 only — no pagination needed for daily tracking
   - Pure RTs can be identified by `retweeted_tweet != null` — keep them for tracking what the Environment_User amplifies

2. If call fails, log error and skip Mode C. Do NOT abort the entire daily pull — Modes A and B data is still valuable.

3. From response, extract tweets from response.data.tweets[]
   - NO date filter — we want all recent posts regardless of age
   - NO views filter — Environment_User's own posts matter regardless of engagement
```

### 3.4 Deduplication

```
1. Read last 10 lines of own_posts.jsonl → extract post_ids into a set
2. For each tweet from get_user_tweets:
   IF tweet.id is already in the set → skip (already recorded)
   ELSE → add to new_posts list
3. If no new posts → log "No new own posts since last pull" and skip writing
```

### 3.5 Normalization

Normalize to the own_posts schema (NOT the full canonical schema — see `data_schema_map.md` Section 4.2):

```
own_post = {
  post_id:          tweet.id,
  text:             tweet.text,
  created_at:       parse_connector_b_date(tweet.createdAt),  // see Section 2.6.1
  views:            tweet.viewCount,
  likes:            tweet.likeCount,
  replies:          tweet.replyCount,
  retweets:         tweet.retweetCount,
  quotes:           tweet.quoteCount,
  bookmarks:        tweet.bookmarkCount,
  url:              tweet.url,
  is_reply:         tweet.isReply,
  in_reply_to_id:   tweet.inReplyToId || null,
  conversation_id:  tweet.conversationId,
  has_quoted_tweet:  tweet.quoted_tweet != null,
  quoted_post_id:   tweet.quoted_tweet?.id || null,
  is_thread:        false,          // updated below
  thread_position:  null,           // updated below
  pull_date:        today (YYYY-MM-DD)
}
```

#### 3.5.1 Thread Detection

```
IF tweet.conversationId == tweet.id AND tweet is NOT a reply:
  → This is a thread starter. Set is_thread: true, thread_position: 1

IF tweet.inReplyToUsername == environment_user_handle AND tweet.conversationId != tweet.id:
  → This is a thread continuation. Set is_thread: true, thread_position: (sequence number)
  → Thread position requires checking other tweets in the same conversationId

OTHERWISE:
  → is_thread: false, thread_position: null
```

### 3.6 Mode C Output

New posts are held in memory for writing in Section 5.

```
new_own_posts = [
  { post_id, text, created_at, views, likes, replies, retweets, quotes, bookmarks, url, is_reply, in_reply_to_id, conversation_id, has_quoted_tweet, quoted_post_id, is_thread, thread_position, pull_date },
  ...
]
```

---

## 4. Normalization & Schema Validation

### 4.1 Pre-Write Validation

Before any data is written to files, validate every post object:

```
For each canonical post (Modes A/B):
  REQUIRED fields check:
    post_id       → non-empty string
    text          → non-empty string
    author_handle → non-empty string
    author_followers → integer ≥ 0
    views         → integer ≥ 0
    likes         → integer ≥ 0
    replies       → integer ≥ 0
    retweets      → integer ≥ 0
    quotes        → integer ≥ 0
    bookmarks     → integer ≥ 0
    created_at    → matches ISO 8601 pattern (YYYY-MM-DDTHH:MM:SSZ)
    url           → starts with "https://x.com/" or "https://twitter.com/"
    source_connector → "A", "B", or "Kaito+B" (enum)
    pull_date     → matches YYYY-MM-DD pattern

  IF any required field is missing or invalid:
    → DROP the post from results
    → Log: "Dropped post {post_id}: invalid field {field_name}"
    → Do NOT abort the run — continue with valid posts

For each own post (Mode C):
  Same validation minus author fields and source_connector
  Additional: is_reply must be boolean, pull_date must be YYYY-MM-DD
```

### 4.2 Cross-Mode Deduplication

After all 3 modes complete, check for duplicate post_ids across modes:

```
- A post found in both Mode A and Mode B: keep the Mode B version (both use Connector B data, but Mode B's TL context is richer)
- A post found in both Mode A/B and Mode C: it's the Environment_User's own post. Keep in BOTH files:
  * canonical version in daily_posts.json (as part of topic/TL themes)
  * own_post version in own_posts.jsonl (for Environment_User tracking)
```

---

## 5. File Output & Append Rules

### 5.1 Write to `daily_posts.json`

```
1. Read the current daily_posts.json file
2. Compute today's date key: YYYY-MM-DD
3. Verify today's key does NOT already exist (checked in pre-flight, but double-check)
4. Combine Mode A and Mode B themes:
   all_themes = mode_a_themes + mode_b_themes

5. Build the daily entry:
   {
     "YYYY-MM-DD": {
       "pull_timestamp": "{ISO 8601 timestamp — MUST use format: YYYY-MM-DDTHH:MM:SSZ (Z suffix, no microseconds, no +00:00 offset)}",
       "account": "{environment_user_handle}",
       "total_posts": {count of all posts across all themes},
       "themes": all_themes
     }
   }

6. Append the new date key to the JSON object
   - Parse existing file → JSON object
   - Add new key-value pair
   - Write back to file with consistent formatting (2-space indent)

7. NEVER modify or delete any existing date keys
   - If the file already has entries for 2026-03-01, 2026-03-02, etc., those remain untouched
   - Only the new date key is added
```

### 5.2 Write to `own_posts.jsonl`

```
1. For each post in new_own_posts (from Mode C):
   - Serialize to a single JSON line (no pretty-printing, no newlines within the object)
   - Append the line to own_posts.jsonl

2. Each line is a complete JSON object followed by a newline character
3. NEVER rewrite the file — only append new lines at the end
4. Maintain chronological order (newest posts appended at bottom)
```

### 5.3 Empty Data Handling

```
- If Mode A returns 0 qualifying posts: log warning, proceed with Mode B/C
- If Mode B returns 0 qualifying posts: log warning, proceed with Mode A/C
- If both A and B return 0 posts: still write daily_posts.json entry with empty themes array (records that a pull was attempted)
- If Mode C returns 0 new posts: log "No new own posts" — do NOT append anything to own_posts.jsonl
- If ALL modes return 0 data: still write daily_posts.json entry (empty themes), skip own_posts.jsonl, log warning
```

---

## 6. Completion Report

Write completion report to `account_data/logs/agent_2_log.txt`. Append (never overwrite) with this format:

```
--- Agent ② Daily Pull Report ---
Date: {YYYY-MM-DD}
Handle: @{environment_user_handle}
Start: {ISO timestamp}
End: {ISO timestamp}
Duration: {seconds}s

Mode A (Topics — Kaito-First):
  Tier used: {PRIMARY: Kaito+B / FALLBACK 1: Connector B search_tweets / FALLBACK 2: Connector A search_x}
  Kaito calls used: {N} (of 80/day shared budget)
  Connector B get_tweet_thread calls: {N}
  Fallback calls (if any): {N} search_tweets / {N} search_x
  Keyword combos searched: {list}
  Raw Kaito results: {N}
  After dedup + pre-filter: {N} (tweets sent to Connector B)
  After full filtering: {N}
  Themes generated: {N}
  Smart engagement tweets: {N} (tweets with Kaito smart_engagement > 0)

Mode B (Thought Leaders — Batched, {num_batches} batches of ~5):
  TLs pulled: {N}/{total TLs in profile}
  TLs skipped (error): {list or "none"}
  Per-batch breakdown:
    Batch 1: {N} TLs, {N} posts after filter, {N} themes
    Batch 2: {N} TLs, {N} posts after filter, {N} themes
    ... (one line per batch)
  Merge:
    Pre-merge themes: {N} (sum across batches)
    Cross-batch duplicates merged: {N}
    Singletons absorbed/dropped: {N}
    Final themes: {N}/10
    Final posts: {N}/30
  Convergence themes: {N}

Mode C (Own Posts):
  Posts returned: {N}
  New (after dedup): {N}
  Skipped (already recorded): {N}

Author Enrichment:
  Needed: {Yes — Connector A fallback active / No — Kaito+B or Connector B provided inline data}
  get_user_info calls: {N}/5 (only if Connector A fallback)
  Authors enriched: {list or "N/A — inline from Connector B"}
  Authors defaulted (failed): {list or "none"}

Output:
  daily_posts.json: {N} themes, {N} total posts written to key {YYYY-MM-DD}
  own_posts.jsonl: {N} new lines appended

Errors: {list of any errors encountered, or "None"}

Status: ✅ COMPLETE / ⚠️ PARTIAL (modes that failed) / ❌ FAILED (critical error)
---
```

---

## 7. Error Handling & Recovery

### 7.1 Connector Failures

| Failure | Impact | Action |
|---------|--------|--------|
| Kaito `kaito_advanced_search` all calls fail | Mode A primary discovery down | Switch to Fallback Tier 1: Connector B `search_tweets` (Section 1.3.1). Log: "⚠️ Kaito unavailable — using Connector B search_tweets for Mode A." |
| Kaito rate limit exhausted (80/day) | Cannot make more Kaito calls | Switch to Fallback Tier 1 for remaining combos. Log cumulative Kaito usage. |
| Kaito returns 0 results across ALL keywords | Unusual — likely API issue | Switch to Fallback Tier 1. If Tier 1 also returns 0, this may be a genuine low-activity period — proceed with Mode B/C. |
| Individual `get_tweet_thread` call fails | Single tweet lost | Log error, skip that tweet, continue with remaining tweets. Do NOT abort. |
| Connector B `search_tweets` fallback all calls fail | Tier 1 fallback also down | Switch to Fallback Tier 2: Connector A `search_x` (last resort). Log: "⚠️ Both Kaito and Connector B search_tweets failed — using Connector A (expensive)." |
| Connector A `search_x` returns 402 CreditsDepleted | Last-resort fallback credits gone | Keep results collected before 402. Proceed with Mode B/C with whatever Mode A data collected. Notify user. |
| Connector B `get_user_tweets` all TL calls fail | Mode B produces 0 data | Log error, proceed with Mode A/C |
| Connector B `get_user_tweets` own posts fail | Mode C produces 0 data | Log error, proceed with Mode A/B |
| Connector B `get_user_info` enrichment fails | Mode A Connector A fallback posts lack author metadata | Default: `author_followers: 0, author_verified: false`. Log warning. Only relevant if Tier 2 fallback active. |
| All connectors (Kaito + Connector B + Connector A) completely down | No data for any mode | Abort run. Write error to log. Do NOT write empty entry to daily_posts.json. |

### 7.2 Data File Corruption

| Failure | Action |
|---------|--------|
| `daily_posts.json` is not valid JSON | Abort. Log: "daily_posts.json corrupted — cannot parse JSON. Manual repair needed." |
| `own_posts.jsonl` has invalid lines | Ignore invalid lines when reading for dedup. Append new valid lines normally. |
| `account_profile.md` missing keyword combos | Skip Mode A. Log: "No keyword combos in profile — Mode A skipped." |
| `account_profile.md` missing thought leaders | Skip Mode B. Log: "No TL list in profile — Mode B skipped." |

### 7.3 Rate Limit Enforcement

```
- search_x (Connector A): Hard cap at 10 calls per daily run. Max 20 tweets per query (limit: 20).
  Track call count during execution. NEVER exceed either limit.
  If approaching call limit: stop Mode A, proceed to Mode B.
  If a call returns more than 20 results: truncate to first 20 before processing.

- get_user_info (Connector B): Soft cap at 5 calls for Mode A enrichment.
  If > 5 unique authors, prioritize authors with most posts in results.

- get_user_tweets (Connector B): 1 call per TL for Mode B + 1 call for Mode C (own handle). Total = TL_count + 1.
  Mode B batching: TLs processed in batches of 5, themes generated per-batch, then merged. Total API calls unchanged.
  Per-TL cap: keep up to 5 posts per TL after freshness/noise filtering (top 5 by signal_score).
```

---

## 8. Skills Reference

| Skill | Usage in Agent ② |
|-------|-----------------|
| `x-research` | Query construction — how to build effective search_x queries |
| `x-mastery` | Signal scoring weights — why replies=27x, retweets=20x, etc. |
| `twitter-algorithm-optimizer` | Understanding which posts X's algorithm amplifies |
| `design-serialization-schema` | Schema validation patterns for JSON/JSONL writes |
