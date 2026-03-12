# Agent ① — Onboarding Agent Configuration

> **Model**: Opus 4.6
> **Trigger**: Manual — user runs `/onboard @handle` (optionally with CTAs)
> **Purpose**: Extract topics, voice, competitors, CTAs from a Environment_User's post history and produce a complete account profile that all downstream agents depend on.
> **Output**: `account_data/profile/account_profile.md` + all account subdirectories
>
> **Runtime**: Read `CLAUDE.md` Section 2 for connector IDs before making any MCP calls.

---

## 0. Load Context & Pre-Flight Checks

> This section mirrors `CLAUDE.md` Section 1.4 (Context Manifest) for Agent ①. If there is ever a conflict, `CLAUDE.md` Section 1.4 wins.

### 0a. Load Context (in this order)

| # | File | What to Read | Category |
|---|------|-------------|----------|
| 1 | `CLAUDE.md` | **Full file** — system rules, connector IDs (Section 2.1), tool matrix (Section 2.2), rate limits (Section 2.3), file ownership (Section 3) | ESSENTIAL |
| 2 | _(this file)_ `config/agent_onboarding.md` | **Full file** — you're already here | ESSENTIAL |
| 3 | `config/mcp_setup_guide.md` | Section 5 (Tool Reference), Section 6 (Decision Tree), Section 7 (Troubleshooting) | REFERENCE |
| 4 | `templates/account_profile_template.md` | **Full file** — this is the output template you must produce | ESSENTIAL |
| 5 | `templates/data_schema_map.md` | Section 3 (Canonical Post Schema), Section 3.1 (Normalization Map) | REFERENCE |
| 6 | `seeds/web3_knowledge_base_seed.md` (or `account_data/knowledge/web3_knowledge_base.md` if it exists) | **Full file** — understand existing web3 context | REFERENCE |

### 0b. Pre-Flight Checks

1. **Verify CLAUDE.md is populated**: From the CLAUDE.md you loaded in 0a, check Section 2.1 connector ID mapping. If the ID column is empty, abort and tell the user to run `/setup` first.
2. **Check for existing profile**: If `account_data/profile/account_profile.md` already exists, warn the user: "A profile already exists for @{handle}. Re-onboarding will overwrite it. Continue? (y/n)"
3. **Parse user input**: The `/onboard` command accepts:
   - Required: `@handle` (the X account to onboard)
   - Optional: CTAs provided inline (e.g., `/onboard @incyd__ CTA: "Check out our tool at example.xyz"`)
   - If no CTAs provided, Step 6 will prompt the user for them

---

## 1. Post Pull

**Goal**: Build a corpus of 200 posts from the Environment_User's account for all subsequent analysis.

**MCP tools** (Connector B ONLY — no other MCPs):
- `get_user_info(userName: "{handle}")` — get profile metadata (bio, follower count, display name, etc.)
- `search_tweets(query: "from:{handle}")` — primary post collection tool (returns originals + replies)

> ⚠️ **Why `search_tweets` instead of `get_user_tweets`?** The `get_user_tweets` endpoint returns originals + quote tweets only (no replies, no pure RTs) and its MCP wrapper doesn't expose the `includeReplies` parameter. For most Environment_User accounts, replies make up 70-90% of posts, so `get_user_tweets` misses the majority. Additionally, its pagination has ~75% overlap between pages (only ~5 new unique posts per additional page). `search_tweets` with the `from:{handle}` query operator returns ALL tweet types and supports reliable pagination via date windowing. Tested and validated on 2026-03-03.

### 1a. Get Account Metadata

Call `get_user_info(userName: "{handle}")` to retrieve:
- Display name, bio, follower/following count, verified status
- `statusesCount` — total lifetime posts (useful for estimating how far back you'll need to go)

### 1b. Collect 200 Posts via `search_tweets` + Date Windowing

The API returns ~20 posts per call. Cursor pagination works within a ~7-day search window but stalls after ~80-100 posts. To reach 200, you must slide the search window backwards using the `until:YYYY-MM-DD` operator.

**Algorithm**:

```
corpus = []
seen_ids = set()
current_query = "from:{handle}"
max_api_calls = 20  (safety cap)
api_calls = 0

WHILE len(corpus) < 200 AND api_calls < max_api_calls:

    # --- Inner loop: paginate within current query window ---
    cursor = null
    stall_count = 0

    WHILE len(corpus) < 200 AND api_calls < max_api_calls:
        IF cursor:
            response = search_tweets(query: current_query, cursor: cursor)
        ELSE:
            response = search_tweets(query: current_query)
        api_calls += 1

        new_posts = [t for t in response.tweets if t.id not in seen_ids]

        IF len(new_posts) == 0:
            stall_count += 1
            IF stall_count >= 2:
                BREAK  # Window exhausted — need date shift
        ELSE:
            stall_count = 0
            for t in new_posts:
                corpus.append(t)
                seen_ids.add(t.id)

        IF NOT response.has_next_page:
            BREAK
        cursor = response.next_cursor

    # --- Date window shift ---
    IF len(corpus) >= 200:
        BREAK

    oldest_date = earliest date in corpus (from createdAt field)
    shift_date = oldest_date - 1 day  (format: YYYY-MM-DD)
    current_query = "from:{handle} until:{shift_date}"
```

**Key implementation notes**:
1. **Deduplication is critical** — date windows can overlap. Track `seen_ids` and only count genuinely new posts.
2. **Date format**: The `until:` operator uses `YYYY-MM-DD` format (e.g., `until:2026-02-21`). Parse the oldest post's `createdAt` field (ISO 8601) and subtract 1 day.
3. **Typical call pattern**: ~4-5 paginated calls per window, ~4-6 date windows to reach 200 posts. Total: ~12-15 API calls for a moderately active account.
4. **Reply-heavy accounts**: Most Environment_User accounts have 70-90% replies in their corpus. This is expected and valuable — replies reveal engagement patterns, voice in context, and relationship networks.
5. **Low-activity accounts**: If 200 posts can't be reached within the 20-call budget, proceed with whatever you have. The minimum viable corpus is 50 posts.

### 1c. API Response Structure

`search_tweets` returns a flat structure (NOT nested under `data` like `get_user_tweets`):

```json
{
  "tweets": [
    {
      "type": "tweet",
      "id": "1895288...",
      "url": "https://x.com/incyd__/status/1895288...",
      "text": "post content here",
      "author": {
        "id": "12345",
        "userName": "incyd__",
        "name": "Ash"
      },
      "createdAt": "2026-02-28T15:30:00.000Z",
      "likeCount": 5,
      "replyCount": 2,
      "retweetCount": 1,
      "quoteCount": 0,
      "viewCount": 1200,
      "bookmarkCount": 3,
      "isReply": false
    }
  ],
  "has_next_page": true,
  "next_cursor": "DAACCgAC..."
}
```

### 1d. Normalize the Corpus

For each post in the collected corpus, capture these normalized fields:

| Normalized Field | Source Field | Notes |
|-----------------|-------------|-------|
| `post_id` | `id` | Unique tweet ID |
| `text` | `text` | Full post text |
| `views` | `viewCount` | May be 0 for older posts |
| `likes` | `likeCount` | |
| `replies` | `replyCount` | |
| `retweets` | `retweetCount` | |
| `quotes` | `quoteCount` | |
| `bookmarks` | `bookmarkCount` | |
| `created_at` | `createdAt` | ISO 8601 timestamp |
| `url` | `url` | Full tweet URL |
| `is_reply` | `isReply` | Boolean — true for replies |
| `type` | `type` | "tweet", "retweet", "quote" |
| `author_handle` | `author.userName` | Should match {handle} |

Sort the corpus by `created_at` descending (newest first).

### 1e. Corpus Summary

After collection, compute and report:
- Total posts collected
- Breakdown: originals vs. replies vs. quote tweets
- Date range: oldest post date — newest post date
- Total engagement: sum of likes, views across corpus

**Output**: Raw post corpus held in agent context (NOT written to disk). This corpus is used by Steps 2–5.

**Error handling**:
- If `get_user_info` fails → Account may be private or suspended. Abort with message.
- If `search_tweets` returns 0 results on first call → Account may not exist, handle may be misspelled, or account has no public posts. Abort with message.
- If corpus < 50 posts after exhausting the 20-call budget → Account is very low activity. Warn user: "Only {N} posts found. Analysis will be limited. Consider proceeding with reduced confidence or waiting for more post history."
- If corpus is 50-199 posts → Proceed normally. Note the actual count in the profile metadata.

**Checkpoint**: Report to user: "Pulled {N} posts from @{handle} ({originals} originals, {replies} replies) spanning {date_range}. Proceeding to topic extraction."

---

## 2. Topic Extraction

**Goal**: Identify the 3–7 core subject areas the Environment_User engages with.

**Skills**: `web3-research` (topic analysis framework)

**Process**:

1. Analyse the full post corpus to identify recurring themes, narratives, and subject areas
2. Cross-reference identified themes against `account_data/knowledge/web3_knowledge_base.md` to map them to known narratives (Active, Fading, On the Rise)
3. For each identified topic, assess:
   - **Frequency**: How often does this topic appear in the corpus? (high/medium/low)
   - **Recency**: Is this topic concentrated in recent posts or distributed evenly?
   - **Engagement**: Do posts on this topic get higher engagement than the Environment_User's average?
4. Rank topics by a combined score of frequency × recency × engagement
5. Select the top 3–7 topics. Fewer is better if the Environment_User is highly focused; more is acceptable for broad accounts
6. For each topic, write a 2–3 sentence description capturing what the Environment_User says about it and why it matters

**Output**: Ordered list of topics with descriptions and confidence levels.

**User checkpoint**: Present the extracted topics to the user. Ask:
- "Are these topics accurate? Would you like to add, remove, or modify any?"
- Wait for user confirmation before proceeding to Step 3

---

## 3. Topic Enrichment + Keyword Generation

**Goal**: Enrich each topic with current web3 context AND generate validated keyword combinations for Agent ②'s daily search.

**MCP tools**:
- Tavily: `tavily_search` (quick context), `tavily_research` (deep dive for complex topics)
- Connector A: `search_x` (keyword combo validation)

**Skills**: `web3-research` (research framework), `x-research` (query decomposition for keyword generation)

### 3a. Topic Enrichment

For each topic (in parallel where possible):

1. Call `tavily_search(query: "{topic_name} web3 crypto 2026")` for quick context
2. If the topic is complex or the user's focus is niche, call `tavily_research(input: "Current state of {topic_name} in crypto/web3: key projects, recent developments, contrarian vs consensus positions")` for deeper context
3. Synthesize findings into the **Web3 Context** field in the profile template:
   - Current state of this narrative
   - Key projects and protocols
   - Recent developments (last 30 days)
   - Contrarian vs consensus positions

### 3b. Keyword Combo Generation

For each topic, generate up to 10 keyword combinations (2 words max each). These are what Agent ② will feed into `search_x` daily.

**Keyword strategy**:
- Each combo should be 2 words maximum (X search works best with short, specific queries)
- Mix broad combos (e.g., "defi revenue") with specific combos (e.g., "aave governance")
- Include protocol names where relevant (e.g., "morpho lending")
- Include narrative terms from the knowledge base (e.g., "tokenized gold")
- Avoid single common words that return noise (e.g., just "ethereum" alone)

### 3c. Keyword Validation

**Critical**: Every keyword combo MUST be validated before committing to the profile.

For each keyword combo:
1. Call `search_x(query: "{combo}", sort: "impressions", limit: 5)`
2. Evaluate the results:
   - **PASS**: Results contain posts related to the intended topic with meaningful engagement (>10 likes on at least 1 post)
   - **MARGINAL**: Results are somewhat relevant but noisy — flag for user review
   - **FAIL**: Results are irrelevant, empty, or all spam — replace with alternative combo
3. Record validation status in the keyword combo table

**Budget**: Max 50 `search_x` calls for keyword validation across all topics. This is a one-time onboarding cost, not subject to the daily 10-call limit.

**Output**: Each topic now has:
- Web3 context enrichment
- Up to 10 validated keyword combos with notes

---

## 4. Voice & Style Extraction

**Goal**: Build a comprehensive voice profile that Agent ③ uses to generate on-brand engagement content.

**Skills**: `brand-voice-extractor` (Extract mode — MUST use this skill)

**Process**:

1. Invoke `brand-voice-extractor` in **Extract mode** with the full post corpus as input
2. The skill will analyse writing patterns across the corpus and output:
   - **Personality traits** with scores (1-10) and evidence from posts
   - **Tone spectrum** (default tone, agreement tone, disagreement tone, excitement tone)
   - **Vocabulary guide** (preferred terms, avoided terms, signature phrases)
   - **Rhythm & structure patterns** (tweet length, thread frequency, punctuation style, emoji usage, hashtag usage)
   - **Content formatting** (media usage, link sharing, quote tweet style)
3. Map the `brand-voice-extractor` output to the profile template Sections 3.1–3.5
4. Include specific post examples as evidence for each trait and pattern

**Quality check**: The voice profile should contain enough detail that someone reading it could write a post that sounds like the Environment_User. If any section feels thin, go back to the corpus and find more examples.

**Output**: Completed Section 3 (Voice & Style Profile) of the account profile.

---

## 5. Competitor & Thought Leader Discovery

**Goal**: Identify (a) direct competitors in the same niche and (b) thought leaders whose posts should be tracked daily by Agent ②.

**MCP tools**:
- Connector B: `get_user_following(userName: "{handle}")` — who the Environment_User follows
- Connector B: `get_user_followers(userName: "{handle}")` — who follows the Environment_User
- Connector B: `get_user_info(userName: "{candidate_handle}")` — check bio, follower count for candidates

**Skills**: `competitive-analysis` (competitor identification framework)

**Process**:

### 5a. Candidate Discovery

1. Pull the Environment_User's following list via `get_user_following(userName: "{handle}")` — these are the accounts the Environment_User already tracks
2. Pull a sample of the Environment_User's followers via `get_user_followers(userName: "{handle}")` — mutual follows often indicate peers
3. From both lists, identify candidates by filtering on:
   - Bio contains keywords related to the Environment_User's topics (from Step 2)
   - Follower count suggests they're active in the niche (not too small, not massive generic accounts)
   - Account is active (posts in last 7 days)

### 5b. Candidate Classification

For each candidate (check up to 30 candidates):

1. Call `get_user_info(userName: "{candidate}")` to get bio, follower count, description
2. Classify as:
   - **Competitor**: Same niche, similar audience size, potentially competing for the same audience
   - **Thought leader**: Established voice in the Environment_User's topics, worth tracking for content ideas and engagement opportunities
   - **Irrelevant**: Different niche, bot, or inactive — discard
3. For competitors: note overlap areas, audience size comparison, differentiation
4. For thought leaders: note why they're worth tracking (e.g., "consistently surfaces early alpha on restaking")

### 5c. Handle Verification

> ⚠️ **MANDATORY STEP** — Do NOT skip. Downstream agents (Agent ② Mode B) will call `get_user_tweets(userName: "{handle}")` using the exact handles stored in the profile. An incorrect handle causes silent failures or returns wrong account data.

For every finalist (both competitors and thought leaders):

1. Call `get_user_info(userName: "{candidate_handle}")` if not already called in Step 5b
2. Verify the returned `userName` field matches the handle you intend to store
3. Verify `followers` count and `description` match the account you identified (not a different user who happens to have a similar name)
4. Store the **exact `userName` value from the API response** in the profile — not the display name, not a guess

If a handle returns a 404 or returns a clearly wrong account (different niche, vastly different follower count), drop that candidate and note it in the onboarding report.

### 5d. Build Lists

- **Competitors**: 3–8 accounts (for Section 4.1 of profile)
- **Thought leaders**: 5–10 accounts (for Section 4.2 — these become Agent ②'s Mode B tracking list)

**Budget**: Max 40 `get_user_info` calls for candidate checking (including handle verification).

**User checkpoint**: Present both lists to the user. Ask:
- "Here are the competitors and thought leaders I've identified. Would you like to add, remove, or reclassify any accounts?"
- Include the verified handle, follower count, and bio snippet for each account so the user can confirm
- Wait for user confirmation before proceeding

---

## 6. CTA Definition

**Goal**: Compile the final CTA list with context rules for when each is appropriate.

**Skills**: `marketing:content-creation` (CTA frameworks)

**Process**:

### 6a. User-Provided CTAs

1. If CTAs were provided with the `/onboard` command, use those
2. If not, prompt the user: "What are your calls-to-action? These are links, products, communities, or actions you want to promote when engaging with relevant posts. Examples: 'Check out our protocol at example.xyz', 'Join our Discord for alpha', 'Try our dashboard at app.example.com'"
3. For each user CTA, define:
   - **Context rule**: When is this CTA appropriate? (e.g., "Only when replying to posts about yield optimization")
   - **Example usage**: A sample reply showing the CTA woven in naturally

### 6b. Agent-Suggested CTAs

1. Analyse the post corpus for recurring topics or themes where the Environment_User has authority
2. Suggest additional CTAs based on patterns found (e.g., "The Environment_User frequently discusses X — a CTA linking to your analysis thread on X could work well")
3. Mark all agent-suggested CTAs as `Approved: pending` — user must approve

### 6c. CTA Rules (standard — apply to all accounts)

These rules are baked into the profile from the template:
- Confidence threshold: ≥ 7
- Frequency cap: 1 CTA per 5 engagement replies
- Format: Woven in naturally, never appended
- Never in: Disagreement replies, condolence/support replies, purely technical corrections

**Output**: Completed Section 5 (CTAs) of the account profile.

---

## 7. Assemble Account Profile

**Goal**: Compile all outputs from Steps 1–6 into the final account profile document and create the Environment_User's directory structure.

**Process**:

### 7a. Create Directory Structure

```
account_data/
├── profile/
│   └── account_profile.md          ← THE OUTPUT
├── data/
│   ├── daily_posts.json            ← Empty, created by Agent ②
│   └── own_posts.jsonl             ← Empty, created by Agent ②
├── output/
│   ├── engagement_replies.xlsx     ← Empty, created by Agent ③
│   └── own_post_recs.xlsx           ← Empty, created by Agent ③
├── analytics/
│   └── analytics_history.jsonl     ← Empty, created by Agent ③
├── weekly/
│   └── own_post_recs_archive/      ← Empty, used by Agent ③ archiving
└── logs/
    ├── agent_1_log.txt             ← Empty
    ├── agent_2_log.txt             ← Empty
    ├── agent_3_log.txt             ← Empty
    └── agent_4_log.txt             ← Empty
```

### 7b. Compile Profile

1. Use `templates/account_profile_template.md` as the base structure
2. Fill in every section from the outputs of Steps 1–6:
   - Section 1 (Account Overview): From Step 1 `get_user_info` data
   - Section 2 (Topics): From Steps 2–3 (topics + enrichment + keyword combos)
   - Section 3 (Voice & Style): From Step 4 (brand-voice-extractor output)
   - Section 4 (Competitors & TLs): From Step 5
   - Section 5 (CTAs): From Step 6
   - Section 6 (Onboarding Metadata): Aggregate counts from all steps
   - Section 7 (Change Log): Initial entry with today's date
3. Write the completed profile to `account_data/profile/account_profile.md`

### 7c. Update CLAUDE.md

Add a row to CLAUDE.md Section 6 (Active Accounts):

```
| @{handle} | {today's date} | {topic_count} topics | {competitor_count} | {tl_count} TLs | Active |
```

### 7d. Write Completion Log

Write to `account_data/logs/agent_1_log.txt`:

```
[{timestamp}] Onboarding complete for @{handle}
Posts pulled: {count}
Date range: {start} — {end}
Topics: {count} ({list of topic names})
Keywords: {validated}/{total} validated
Competitors: {count}
Thought leaders: {count}
CTAs: {user_count} user + {agent_count} agent-suggested
Kaito used: {yes/no}
Profile written to: account_data/profile/account_profile.md
```

### 7e. Final User Handoff

Present the completed profile to the user with a summary:

```
✅ Onboarding complete for @{handle}

Topics: {list}
Thought leaders: {list of handles}
Keyword combos: {count} validated

Profile: account_data/profile/account_profile.md

You can edit this profile at any time. When ready, Agent ② will use it
for daily pulls. Run /daily @{handle} to start.
```

---

## MCP Budget Summary

| Connector | Tool | Max Calls | Step |
|-----------|------|-----------|------|
| Connector B | `get_user_info` | 1 (target) + 40 (candidate checks) = 41 | Steps 1, 5 |
| Connector B | `search_tweets` | 20 (post pull: ~12-15 typical, 20 safety cap) | Step 1 |
| Connector B | `get_user_following` | 1 | Step 5 |
| Connector B | `get_user_followers` | 1 | Step 5 |
| Connector A | `search_x` | 50 (keyword validation) | Step 3 |
| Tavily | `tavily_search` | 7 (1 per topic) | Step 3 |
| Tavily | `tavily_research` | 3 (complex topics only) | Step 3 |
| Kaito | `kaito_advanced_search` | 3 (optional, narrative setup) | Step 3 |

**Total estimated MCP calls**: ~80–130 per onboarding (one-time cost per account).

> **Note on Step 1 budget**: The 200-post pull uses `search_tweets` (Connector B) with date windowing. Typical accounts need ~12-15 calls. The 20-call safety cap handles edge cases (very active accounts with many date windows). This does NOT use Connector A — `search_tweets` is a Connector B tool and has no daily call limit.

---

## Skill Dependencies

| Skill | Step | Mode | Purpose |
|-------|------|------|---------|
| `web3-research` | 2, 3 | Analysis, Research | Topic extraction, topic enrichment via Tavily |
| `brand-voice-extractor` | 4 | Extract | Voice & style profile from post corpus |
| `competitive-analysis` | 5 | Analysis | Competitor identification and classification |
| `x-research` | 3 | Query decomposition | Keyword combo generation strategy |
| `marketing:content-creation` | 6 | CTA frameworks | CTA definition and context rules |

---

## Error Handling

| Error | Step | Action |
|-------|------|--------|
| Account is private/suspended | 1 | `get_user_info` will fail. Abort onboarding with clear message. |
| `search_tweets` returns 0 on first call | 1 | Handle may be misspelled or account has no public posts. Abort with message. |
| Corpus < 50 posts after 20 API calls | 1 | Account is very low activity. Warn user, continue with reduced confidence. |
| Corpus 50-199 posts after 20 API calls | 1 | Normal for less active accounts. Proceed, note actual count in metadata. |
| Pagination stalls (0 new posts) | 1 | Expected — shift date window backwards using `until:` operator. See Step 1b algorithm. |
| `search_x` unavailable | 3 | Skip keyword validation; mark all combos as "unvalidated — test manually" |
| `brand-voice-extractor` skill not available | 4 | Fall back to manual analysis of post corpus using the template's Section 3 structure |
| `get_user_following` returns empty | 5 | Use `get_user_followers` only; supplement with Kaito `kaito_smart_following` if available |
| User provides no CTAs | 6 | Acceptable — Section 5.1 stays empty; only agent-suggested CTAs appear |
| Kaito unavailable | 3 | Normal — use Tavily for all enrichment; note in metadata |
