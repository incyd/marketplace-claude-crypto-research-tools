# V3 Daily Environment_User — Data Schema Map

> **Purpose**: Single source of truth for every data structure in the pipeline. Every agent config MUST reference this document. Every write operation MUST conform to these schemas. Every read operation MUST expect exactly these fields.
>
> **Schema system**: JSON Schema (draft 2020-12) — chosen for broad tooling support, human readability, and evolution-friendliness in a file-based pipeline.
>
> **Evolution policy**: Only additive, optional field changes between versions. Required fields are locked after v1.0. See Section 7 for full evolution rules.
>
> **Which agents read which sections**: See `CLAUDE.md` Section 1.4 (Context Manifest) for the authoritative per-agent file list. In summary: Agent ① reads Sections 3, 3.1. Agent ② reads Sections 3, 3.1, 4.1, 4.2. Agent ③ reads Sections 4.3, 4.4. Agent ④ reads Sections 4.3, 4.4.

---

## 1. Pipeline Data Flow Overview

```
MCP TOOLS                          DATA FILES                         CONSUMERS
─────────────────────────────────────────────────────────────────────────────────

MODE A — Keyword Search (Kaito-first):
  Kaito (Kaito_AI)                                                    Agent ③
    kaito_advanced_search ─┐  (metadata + URLs                       (reads today)
    (author_type:Individual│   with tweet IDs)                        Agent ④
     sort_by:engagement    │                                          (reads 7 days)
     sources:Twitter, 24h) │
                           │  extract tweet IDs
                           ↓  from Kaito URLs
  Connector B (32493dcb)   │
    get_tweet_thread ──────┤  (full tweets +          ┌─────────────────┐
    (fetch by tweet ID,    │   nested author —         │                 │
     extract match,        │   NO enrichment needed)   │ daily_posts.json│──▶ Agents ③④
     discard rest)         ├──▶ Agent ② ──────────▶   │ (date-keyed)    │
                           │    normalizes             └─────────────────┘
  FALLBACK 1: Connector B search_tweets (if Kaito unavailable)
  FALLBACK 2: Connector A search_x (LAST RESORT — expensive)

Connector B                                       ┌─────────────────┐
  get_user_tweets ────▶ Agent ② ──────────────▶  │ own_posts.jsonl │──▶ Agents ③④
  (Environment_User's own handle)    dedup & append            │ (1 post/line)   │
                                                  └─────────────────┘

Tavily (f5b10baf)                                 ┌─────────────────┐
  tavily_search ──────▶ Agent ③ ──────────────▶  │analytics_history│──▶ Agent ④
  tavily_research       analysis + content        │  .jsonl (1/day) │
                                                  ├─────────────────┤
                                                  │engagement_replies│──▶ User
                                                  │  .xlsx (append) │
                                                  ├─────────────────┤
                                                  │own_post_recs   │──▶ Agent ④
                                                  │  .xlsx (append) │    + User
                                                  └─────────────────┘

Tavily (f5b10baf)
  tavily_search ──────▶ Agent ④ ──────────────▶ weekly reports + KB edits
  tavily_research       trend validation

Kaito (PRIMARY for Mode A, max 80 req/day shared)
  kaito_advanced_search ▶ Agent ② ──────────────▶ Mode A keyword discovery (PRIMARY)
  kaito_advanced_search ▶ Agent ① ──────────────▶ narrative setup (onboarding, optional)
  kaito_engagement ────▶ Agent ③ ──────────────▶ smart engagement signal (optional)
  kaito_mindshare ────▶ Agent ④ ──────────────▶ mindshare + sentiment reports (optional)
  kaito_sentiment       weekly trend validation

ONBOARDING (Agent ①):
  Connector B: search_tweets (200-post pull via "from:{handle}" + date windowing),
               get_user_info, get_user_followers, get_user_following
  Connector A: search_x (keyword validation)
  Kaito (if available): kaito_advanced_search (narrative setup)
  Tavily: tavily_research
  → OUTPUT: account_profile.md
  NOTE: get_user_tweets is NOT used for onboarding (returns originals + QTs only —
        no replies, no pure RTs — and pagination has ~75% overlap). search_tweets returns all tweet types.

CONNECTOR COST RULE:
  Kaito is PRIMARY for Mode A keyword search (kaito_advanced_search).
  Connector A (search_x) is LAST RESORT fallback — expensive, use only if Kaito+B both fail.
  Do NOT use get_tweet (Connector A) — all tweet retrieval → Connector B.

KAITO RATE LIMIT:
  Max 80 Kaito API requests per day across all agents.
  Kaito IS the primary tool for Mode A keyword search (~6-10 calls/day = 8-12% of budget).
  Fallback chain: Kaito+B → Connector B search_tweets → Connector A search_x (last resort).
```

---

## 2. MCP Tool Response Schemas (Source Data)

### 2.1 Connector B Tweet Object (Canonical)

This is the raw tweet object returned by all Connector B tools. The **tweet fields are identical** across tools, but the **wrapper differs**:

```
get_user_tweets WRAPPER:  { status: string, code: int, msg: string, data: { tweets: Tweet[], pin_tweet: Tweet|null } }
search_tweets WRAPPER:    { tweets: Tweet[], has_next_page: boolean, next_cursor: string }  ← FLAT, no "data" nesting
get_tweet_thread WRAPPER: { tweets: Tweet[] }
get_tweet_replies WRAPPER: { tweets: Tweet[] }
```

> ⚠️ **Agent ① critical**: For the 200-post onboarding pull, you use `search_tweets` which returns tweets at `response.tweets` (flat). Do NOT look for `response.data.tweets` — that's the `get_user_tweets` wrapper only.

**Tweet Object Fields:**

| Field | Type | Nullable | Description | V3 Usage |
|-------|------|----------|-------------|----------|
| `type` | string | No | Always "tweet" | Filter non-tweet types |
| `id` | string | No | Unique tweet ID (numeric string) | **Primary key** — dedup, cross-reference |
| `url` | string | No | x.com URL | Engagement spreadsheet link |
| `twitterUrl` | string | No | twitter.com URL (legacy) | Not used — prefer `url` |
| `text` | string | No | Full tweet text | Content analysis, reply context |
| `source` | string | No | Client used (e.g., "Twitter for iPhone") | Not used in V3 MVP |
| `retweetCount` | int | No | Retweet count | Signal scoring (weight: 20x) |
| `replyCount` | int | No | Reply count | Signal scoring (weight: 27x) |
| `likeCount` | int | No | Like count | Signal scoring (weight: 1x) |
| `quoteCount` | int | No | Quote tweet count | Signal scoring (weight: 24x) |
| `viewCount` | int | No | Impression count | Signal scoring, xlsx column |
| `createdAt` | string | No | Creation timestamp (e.g., "Sat Feb 28 18:44:17 +0000 2026") | Date filtering, freshness check |
| `lang` | string | No | Language code (e.g., "en") | Filter non-English if needed |
| `bookmarkCount` | int | No | Bookmark count | Signal scoring (weight: 4x) |
| `isReply` | boolean | No | Whether this tweet is a reply | Filter/categorize |
| `inReplyToId` | string | Yes | Parent tweet ID (if reply) | Thread following |
| `conversationId` | string | No | Root conversation ID | Thread grouping |
| `inReplyToUserId` | string | Yes | Parent author's user ID | Reply context |
| `inReplyToUsername` | string | Yes | Parent author's @handle | Reply context |
| `author` | object | No | Author object (see 2.2) | Author metadata |
| `entities` | object | No | Hashtags, URLs, mentions | Topic extraction |
| `extendedEntities` | object | Yes | Media attachments | Not used in V3 MVP |
| `quoted_tweet` | Tweet | Yes | Full quoted tweet object (recursive) | Context for QTs |
| `retweeted_tweet` | Tweet | Yes | Full retweeted tweet object (recursive) | Filter RTs from analysis |
| `card` | object | Yes | Link card data | Not used in V3 MVP |
| `place` | object | Yes | Location data | Not used in V3 MVP |
| `isLimitedReply` | boolean | No | Reply restrictions active | Not used in V3 MVP |
| `article` | object | Yes | Long-form article data | Not used in V3 MVP |
| `displayTextRange` | int[] | No | Character range of display text | Not used |

### 2.2 Connector B Author Object (Nested in Tweet)

| Field | Type | Nullable | Description | V3 Usage |
|-------|------|----------|-------------|----------|
| `userName` | string | No | @handle (without @) | **Author identifier** — xlsx column, TL matching |
| `id` | string | No | Numeric user ID | Deduplication |
| `name` | string | No | Display name | xlsx column |
| `followers` | int | No | Follower count | Signal scoring, xlsx column |
| `following` | int | No | Following count | Not used in V3 MVP |
| `isBlueVerified` | boolean | No | Has blue checkmark | Signal scoring modifier |
| `description` | string | No | Bio text | Onboarding — competitor/TL identification |
| `location` | string | No | Profile location | Not used in V3 MVP |
| `profilePicture` | string | No | Avatar URL | Not used in V3 MVP |
| `statusesCount` | int | No | Total tweets posted | Not used in V3 MVP |
| `favouritesCount` | int | No | Total likes given | Not used in V3 MVP |
| `profile_bio.description` | string | No | Full bio with entity context | Onboarding — voice context |
| `profile_bio.entities.description.user_mentions` | array | Yes | @mentions in bio | Onboarding — affiliation discovery |

### 2.3 Connector A Response Schemas (Verified) — ⚠️ FALLBACK ONLY

> **Connector A is LAST RESORT for Mode A.** Primary path is Kaito+B (see Section 1 pipeline diagram). These schemas are retained for fallback documentation only.

Connector A (`3441bdf2`) returns a **flat tweet structure** with a nested `metrics` object. Field names differ significantly from Connector B.

#### 2.3.1 `search_x` Response

```
WRAPPER: { tweets: SearchTweet[], count: int }
```

**SearchTweet Object Fields (verified via live call):**

| Field | Type | Nullable | Description | V3 Usage |
|-------|------|----------|-------------|----------|
| `id` | string | No | Tweet ID (numeric string) | **Primary key** — dedup |
| `text` | string | No | Full tweet text | Content analysis |
| `author_id` | string | No | Author's numeric user ID | Cross-ref with `get_user_info` |
| `username` | string | No | @handle (without @) | **Author identifier** — xlsx column, TL matching |
| `name` | string | No | Display name | xlsx column |
| `created_at` | string | No | ISO 8601 timestamp (e.g., `"2026-02-26T04:05:46.000Z"`) | Date filtering (already ISO — no parsing needed) |
| `conversation_id` | string | No | Root conversation ID | Thread grouping |
| `metrics` | object | No | Nested engagement metrics (see below) | Signal scoring |
| `metrics.likes` | int | No | Like count | Signal scoring (weight: 1x) |
| `metrics.retweets` | int | No | Retweet count | Signal scoring (weight: 20x) |
| `metrics.replies` | int | No | Reply count | Signal scoring (weight: 27x) |
| `metrics.quotes` | int | No | Quote tweet count | Signal scoring (weight: 24x) |
| `metrics.impressions` | int | No | View/impression count | Signal scoring, xlsx column |
| `metrics.bookmarks` | int | No | Bookmark count | Signal scoring (weight: 4x) |
| `urls` | string[] | No | URLs embedded in tweet | Not used in V3 MVP |
| `mentions` | string[] | No | @mentions in tweet | Topic extraction |
| `hashtags` | string[] | No | Hashtags in tweet | Topic extraction |
| `tweet_url` | string | No | Full x.com URL (e.g., `https://x.com/user/status/123`) | xlsx column, engagement link |

> **CRITICAL DIFFERENCES FROM CONNECTOR B:**
> - Metrics are **nested** in a `metrics` object (not flat fields like `likeCount`)
> - Author fields are **flat** (`username`, `name`) — no nested `author` object
> - No `author.followers`, `author.isBlueVerified` — requires separate `get_user_info` call
> - No `isReply`, `inReplyToId`, `lang`, `bookmarkCount` as top-level fields
> - No `quoted_tweet` or `retweeted_tweet` recursive objects
> - No `source`, `entities`, `extendedEntities` objects
> - Uses `tweet_url` (not `url`) for the tweet link

#### 2.3.2 `get_tweet` Response

```
WRAPPER: { tweet: TweetObject }
```

Returns the **same field structure** as `search_x` tweets, but wrapped in a singular `tweet` key (not `tweets` array). All fields identical to the SearchTweet table above.

#### 2.3.3 `get_profile` and `get_thread` — Status: 500 Error

These tools returned HTTP 500 errors during testing. They are listed in the MCP connector but may be intermittently unavailable. V3 should NOT depend on these tools for core operations:
- `get_profile`: Use Connector B `get_user_info` instead
- `get_thread`: Use Connector B `get_tweet_thread` instead (also returned 500 — fall back to `get_tweet_replies`)

> **NOTE**: Agent ② MUST normalize Connector A responses to the V3 canonical format (Section 3) before writing to any data file. See Section 3.1 for the complete field mapping.

### 2.4 Connector B `get_user_info` Response (Verified)

```
WRAPPER: { status: string, msg: string, data: UserInfoObject }
```

**UserInfoObject Fields (verified via live call):**

| Field | Type | Nullable | Description | V3 Usage |
|-------|------|----------|-------------|----------|
| `id` | string | No | Numeric user ID | Dedup, cross-ref |
| `name` | string | No | Display name | Profile display |
| `userName` | string | No | @handle (without @) | **Profile identity** |
| `description` | string | No | Bio text | Voice extraction, competitor analysis |
| `location` | string | Yes | Profile location | Not used in V3 MVP |
| `url` | string | Yes | Profile URL | Not used in V3 MVP |
| `entities` | object | Yes | URL entities in bio/profile | Not used in V3 MVP |
| `protected` | boolean | No | Account is protected | Skip if true |
| `isVerified` | boolean | No | Legacy verified status | Not used |
| `isBlueVerified` | boolean | No | Blue checkmark status | Signal modifier |
| `verifiedType` | string | Yes | Verification type | Not used |
| `followers` | int | No | Follower count | Influence scoring, xlsx column |
| `following` | int | No | Following count | Not used in V3 MVP |
| `favouritesCount` | int | No | Total likes given | Not used |
| `statusesCount` | int | No | Total tweets posted | Activity level context |
| `mediaCount` | int | No | Total media tweets | Not used |
| `createdAt` | string | No | Account creation date | Account age context |
| `coverPicture` | string | Yes | Banner image URL | Not used |
| `profilePicture` | string | No | Avatar URL | Not used |
| `canDm` | boolean | No | DM availability | Not used |
| `affiliatesHighlightedLabel` | object | Yes | Affiliate label data | Not used |
| `isAutomated` | boolean | No | Whether account is automated | Flag for filtering |
| `automatedBy` | string | Yes | Who automated the account | Not used |
| `pinnedTweetIds` | string[] | No | Pinned tweet IDs | Agent ① — analyse pinned content |

### 2.5 Connector B `get_user_followers` Response (Verified)

Returns a **different User object** from the Author object nested in tweets (Section 2.2). This is the follower/following user shape.

```
WRAPPER: { code: int, followers: FollowerUser[], has_next_page: boolean, next_cursor: string, status: string, msg: string }
```

**FollowerUser Object Fields (verified via live call):**

| Field | Type | Nullable | Description | V3 Usage |
|-------|------|----------|-------------|----------|
| `id` | string | No | Numeric user ID | Cross-ref |
| `name` | string | No | Display name | Display |
| `userName` | string | No | @handle | Identifier |
| `screen_name` | string | No | @handle (duplicate of `userName`) | Not used — prefer `userName` |
| `description` | string | Yes | Bio text | Competitor analysis |
| `location` | string | Yes | Profile location | Not used |
| `url` | string | Yes | Profile URL | Not used |
| `email` | string | Yes | Email (usually null) | Not used |
| `created_at` | string | Yes | Account creation date | Not used |
| `followers_count` | int | No | Follower count | Influence scoring |
| `following_count` | int | No | Following count | Not used |
| `friends_count` | int | No | Friends count (same as following) | Not used |
| `favourites_count` | int | No | Total likes given | Not used |
| `statuses_count` | int | No | Total tweets | Not used |
| `media_tweets_count` | int | No | Total media tweets | Not used |
| `profile_image_url_https` | string | No | Avatar URL | Not used |
| `profile_banner_url` | string | Yes | Banner URL | Not used |
| `protected` | boolean | No | Account is protected | Skip if true |
| `verified` | boolean | No | Verified status | Signal modifier |
| `can_dm` | boolean | No | DM availability | Not used |

> **NOTE**: This User object uses `snake_case` field names (`followers_count`) vs the Author object's `camelCase` (`followers`). Agent ① must handle both shapes during onboarding competitor discovery.

### 2.6 Connector B `get_trending_topics` Response (Verified)

```
WRAPPER: {
  status: string,
  msg: string,
  trends: TrendObject[],
  metadata: {
    timestamp: string,
    refresh_interval_millis: int,
    woeid: { name: string, id: int },
    context_mode: string
  }
}
```

**TrendObject Fields (verified via live call):**

| Field | Type | Description | V3 Usage |
|-------|------|-------------|----------|
| `trend.name` | string | Trend name/hashtag (e.g., "#Bitcoin", "Solana") | Topic signal detection |
| `trend.target.query` | string | Search query for this trend | Can feed into `search_x` calls |
| `trend.rank` | int | Rank position (1 = top trend) | Prioritization |

> **V3 Usage**: Agent ② can optionally check trending topics to validate whether a keyword combo aligns with current trends. Not a core data source but useful as a signal booster.

### 2.7 Connector B Pagination Pattern (Verified)

Several Connector B tools return paginated results. The pagination wrapper is consistent across these tools:

**Paginated tools**: `get_tweet_replies`, `get_tweet_quotes`, `get_user_mentions`, `get_user_followers`

```
PAGINATION FIELDS (appended to each response):
{
  ...tool-specific data...,
  "has_next_page": boolean,    // Whether more results exist
  "next_cursor": string|null,  // Cursor token for next page (pass as `cursor` param)
  "status": string,            // "ok" on success
  "msg": string                // Status message
}
```

**Pagination rules for Agent ②:**
- Always check `has_next_page` before making follow-up calls
- Pass `next_cursor` as the `cursor` parameter in the next call
- Respect rate limits: max 3 pagination calls per tool per daily run
- Stop early if enough posts collected (Mode B: up to 5 per TL after filtering, Mode C: all available)

### 2.8 Connector B Tool Availability Matrix (Verified)

Based on live testing, some tools returned 500 errors. V3 agent configs must account for this:

| Tool | Status | Fallback |
|------|--------|----------|
| `get_user_tweets` | ✅ Working | — (core tool, no fallback) |
| `get_user_info` | ✅ Working | — (core tool) |
| `get_tweet_replies` | ✅ Working | — |
| `get_tweet_quotes` | ✅ Working | — |
| `get_user_mentions` | ✅ Working | — |
| `get_user_followers` | ✅ Working | — |
| `get_trending_topics` | ✅ Working | — |
| `search_tweets` | ⚠️ Intermittent (last 500: 2026-03-05) | Returns same rich tweet structure as `get_user_tweets`. Wrapper: `{ tweets: Tweet[], has_next_page: boolean, next_cursor: string }`. Supports operators: `from:user`, `min_faves:N`, `since:YYYY-MM-DD`, `queryType`: "Latest"/"Top". **Note**: Was working 2026-03-02 but returned 500 on 2026-03-05. Treat as unreliable fallback — always have a secondary plan if this tool fails. |
| `search_users` | ❌ 500 Error | Use `get_user_followers` + filter by bio keywords |
| `get_user_following` | ❌ 500 Error | Use `get_user_followers` of target accounts |
| `get_tweet_thread` | ❌ 500 Error | Use `get_tweet_replies` on root tweet |

> **Impact on PRD**: Architecture Section 2.1 lists `search_users` for competitor discovery. Since it's unreliable, Agent ① should fallback to `get_user_followers` of known accounts + `get_user_info` to filter by bio keywords. Architecture Section 4.2 lists `get_tweet_thread` for supplementary thread following. Since it's unreliable, use `get_tweet_replies` instead.

### 2.9 Tavily Response Schema (Verified)

Only one Tavily instance is reliably available: `f5b10baf`. Instance `a0103b84` returned 500 errors.

#### 2.9.1 `tavily_search` Response

```json
{
  "query": "string — the search query",
  "follow_up_questions": ["string — suggested follow-up queries"],
  "answer": "string — AI-generated answer summary",
  "images": [],
  "results": [
    {
      "url": "string — source URL",
      "title": "string — page title",
      "content": "string — relevant content excerpt",
      "score": "number — relevance score (0-1)",
      "raw_content": "string|null — full page content (if requested)"
    }
  ],
  "response_time": "number — seconds",
  "request_id": "string — unique request ID"
}
```

**V3 Usage**: Agent ③ uses `tavily_search` and `tavily_research` for web3 topic enrichment. The `answer` field provides a quick summary; `results[].content` provides source-backed detail. Agent ④ uses it for narrative validation and emerging trend detection.

#### 2.9.2 Tavily Instance Selection

| Instance | ID | Status | Use |
|----------|-----|--------|-----|
| Primary | `f5b10baf` | ✅ Working | All Tavily operations |
| Secondary | `a0103b84` | ❌ 500 Error | Do not use; fallback only if primary fails |

### 2.10 Kaito AI Response Schemas (Verified)

Kaito is **PRIMARY for Agent ② Mode A keyword search** via `kaito_advanced_search` (see Section 1 pipeline diagram). For other agents (①③④), Kaito remains optional. **Max 80 Kaito API requests per day across all agents.** Mode A uses ~6-10 calls/day.

#### 2.10.1 `kaito_advanced_search` Response

```
WRAPPER: { results: KaitoResult[] }
```

**KaitoResult Object Fields (verified via live call):**

| Field | Type | Nullable | Description | V3 Usage |
|-------|------|----------|-------------|----------|
| `type` | string | No | "Twitter" or "News" | Filter for Twitter only |
| `summary` | string | No | AI-generated summary of the tweet (NOT raw text) | Narrative setup, topic discovery |
| `author_username` | string | No | @handle (without @) | Author identifier |
| `author_name` | string | No | Display name | Author display |
| `sentiment_score` | object | No | Per-token sentiment (e.g., `{ "ETH": 0.8 }`) | Sentiment context |
| `created_at` | string | No | ISO 8601 timestamp (e.g., `"2026-02-06T20:46:11.000Z"`) | Date filtering |
| `url` | string | No | Tweet URL (`https://twitter.com/{user_id}/status/{tweet_id}`) | Extract tweet ID, engagement link |

> **CRITICAL DIFFERENCES FROM CONNECTOR A/B:**
> - Returns AI **summaries** instead of raw tweet text
> - **No engagement metrics** (no likes, retweets, replies, views, bookmarks)
> - **No author metadata** (no followers, verified status)
> - URL format includes user_id (not handle): `https://twitter.com/{numeric_user_id}/status/{tweet_id}`
> - Tweet ID can be extracted from URL: split by `/`, take last segment
>
> **Usage note**: `kaito_advanced_search` IS the PRIMARY tool for Mode A keyword search (Agent ②). Kaito returns tweet URLs; Agent ② extracts tweet IDs and fetches full copy via Connector B `get_tweet_thread`. The Kaito response provides AI summaries (for triage) and engagement metrics (for pre-filtering), but the actual tweet text for `daily_posts.json` comes from Connector B. Kaito is also used for narrative setup during Agent ① onboarding.

#### 2.10.2 Other Kaito Tools

| Tool | Returns | V3 Usage | Priority |
|------|---------|----------|----------|
| `kaito_engagement` | Total + smart engagement volume for a token/keyword | Agent ③ — data point for deciding which posts to engage with (smart account activity) | **High** |
| `kaito_mindshare` | Daily mindshare time series (proportion of crypto Twitter conversation) | Agent ④ — validate which projects community is active about | Medium |
| `kaito_sentiment` | Daily bullish/bearish sentiment scores | Agent ④ — narrative sentiment validation | Medium |
| `kaito_mindshare_arena` | Project rankings by mindshare score | Agent ① — competitive positioning, Agent ④ — rank tracking | Medium |
| `kaito_smart_followers` | Smart follower count/list for a Twitter user | Agent ① — onboarding influence assessment | Low |
| `kaito_smart_following` | Last 100 smart accounts followed by a user | Agent ① — auto-seed TL list | Medium |
| `kaito_tweet_engagement_info` | Detailed engagement metrics for a single tweet | Backup — per-tweet metrics if needed, not critical | Low |
| `kaito_mentions` | Daily mention counts by source | Agent ④ — cross-platform mention tracking | Low |
| `kaito_narrative_mindshare` | Daily mindshare for a narrative (AI, DeFi, L2) | Agent ④ — macro narrative context | Low |
| `kaito_events` | Upcoming catalyst events for a token | Agent ④ — content planning | Low |

#### 2.10.3 Kaito Availability & Rate Limit

Agents MUST check for Kaito availability at runtime:
- If Kaito tools are callable → use as PRIMARY for Agent ② Mode A keyword search + supplementary intelligence for other agents
- If not available for Agent ② → fall back to Connector B `search_tweets` (Tier 1), then Connector A `search_x` (Tier 2 — last resort)
- If not available for Agents ①③④ → skip Kaito features gracefully (optional for these agents)
- **Max 80 Kaito API requests per day** across all agents — track cumulative call count
- Kaito discovery feeds into `daily_posts.json` indirectly: Kaito URLs → Connector B `get_tweet_thread` → canonical post schema (source_connector: "Kaito+B")

---

## 3. V3 Canonical Post Schema (Normalized)

This is the **internal** post format that Agent ② writes to data files. It normalizes differences between Connector A and Connector B into a single canonical structure. (Kaito does not feed into this schema — it enriches agent reports separately.)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "v3/schemas/canonical_post/v1",
  "title": "V3 Canonical Post",
  "description": "Normalized post object written by Agent ② to daily_posts.json and own_posts.jsonl",
  "type": "object",
  "required": [
    "post_id", "text", "author_handle", "author_followers",
    "views", "likes", "replies", "retweets", "quotes", "bookmarks",
    "created_at", "url", "source_connector", "pull_date"
  ],
  "properties": {
    "post_id":          { "type": "string",  "description": "Unique tweet ID (primary key for dedup)" },
    "text":             { "type": "string",  "description": "Full tweet text" },
    "author_handle":    { "type": "string",  "description": "@handle without @" },
    "author_name":      { "type": "string",  "description": "Display name" },
    "author_followers":  { "type": "integer", "description": "Follower count at time of pull" },
    "author_verified":  { "type": "boolean", "description": "Blue verified status" },
    "views":            { "type": "integer", "description": "Impression count" },
    "likes":            { "type": "integer", "description": "Like count" },
    "replies":          { "type": "integer", "description": "Reply count" },
    "retweets":         { "type": "integer", "description": "Retweet count" },
    "quotes":           { "type": "integer", "description": "Quote tweet count" },
    "bookmarks":        { "type": "integer", "description": "Bookmark count" },
    "created_at":       { "type": "string",  "format": "date-time", "description": "ISO 8601 timestamp (normalized from MCP response)" },
    "url":              { "type": "string",  "format": "uri", "description": "x.com tweet URL" },
    "lang":             { "type": "string",  "description": "Language code (e.g., 'en')" },
    "is_reply":         { "type": "boolean", "description": "Whether this is a reply" },
    "in_reply_to_id":   { "type": ["string", "null"], "description": "Parent tweet ID if reply" },
    "conversation_id":  { "type": "string",  "description": "Root conversation thread ID" },
    "has_quoted_tweet":  { "type": "boolean", "description": "Whether this quotes another tweet" },
    "quoted_post_id":   { "type": ["string", "null"], "description": "Quoted tweet ID if present" },
    "is_retweet":       { "type": "boolean", "description": "Whether this is a retweet" },
    "source_connector": { "type": "string",  "enum": ["A", "B", "Kaito+B"], "description": "Which MCP connector provided this data. Kaito+B = Kaito discovery + Connector B full tweet fetch (primary Mode A path)" },
    "pull_date":        { "type": "string",  "format": "date", "description": "YYYY-MM-DD date of the pull run" },
    "signal_score":     { "type": "number",  "description": "Computed engagement signal score from weighted formula (Section 4.3). Optional — added by Agent ② during theme clustering." }
  },
  "additionalProperties": false
}
```

### 3.1 Normalization Map: MCP → Canonical (Verified)

| Canonical Field | Connector B Source | Connector A Source | Notes |
|----------------|-------------------|-------------------|-------|
| `post_id` | `id` | `id` | Primary key for dedup |
| `text` | `text` | `text` | Full tweet text |
| `author_handle` | `author.userName` | `username` | All flat strings |
| `author_name` | `author.name` | `name` | All flat strings |
| `author_followers` | `author.followers` | *Not available* | **A requires `get_user_info` call or default to 0** |
| `author_verified` | `author.isBlueVerified` | *Not available* | **A requires `get_user_info` call or default to false** |
| `views` | `viewCount` | `metrics.impressions` | |
| `likes` | `likeCount` | `metrics.likes` | |
| `replies` | `replyCount` | `metrics.replies` | |
| `retweets` | `retweetCount` | `metrics.retweets` | |
| `quotes` | `quoteCount` | `metrics.quotes` | |
| `bookmarks` | `bookmarkCount` | `metrics.bookmarks` | |
| `created_at` | `createdAt` → **parse to ISO** | `created_at` (already ISO with ms) | Strip `.000Z` → `Z` |
| `url` | `url` | `tweet_url` | **Different field names across connectors!** |
| `lang` | `lang` | *Not available* | Default to `"en"` for A |
| `is_reply` | `isReply` | `conversation_id != id` | |
| `in_reply_to_id` | `inReplyToId` | *Not available* | Default to null for A |
| `conversation_id` | `conversationId` | `conversation_id` | |
| `has_quoted_tweet` | `quoted_tweet != null` | *Not available* | Default to false for A |
| `quoted_post_id` | `quoted_tweet.id` | *Not available* | Default to null for A |
| `is_retweet` | `retweeted_tweet != null` | *Not available* | Default to false for A |
| `source_connector` | `"B"` (hardcoded) | `"A"` (hardcoded) | Kaito+B path: `"Kaito+B"` (hardcoded) |
| `pull_date` | Current date (YYYY-MM-DD) | Current date (YYYY-MM-DD) | Agent ② generates |

> **IMPORTANT PARSING RULES:**
> - Connector B `createdAt` format: `"Sat Feb 28 18:44:17 +0000 2026"` → parse to `"2026-02-28T18:44:17Z"`
> - Connector A `created_at` format: `"2026-02-26T04:05:46.000Z"` → strip milliseconds to `"2026-02-26T04:05:46Z"`
> - Connector A `tweet_url` maps to canonical `url` — do NOT use Connector A's `urls` array (that's embedded URLs in tweet text)
>
> **CONNECTOR A ENRICHMENT STRATEGY:**
> Connector A `search_x` responses lack `author_followers` and `author_verified`. For Mode A (topics pull), Agent ② should:
> 1. Collect all unique author handles from `search_x` results
> 2. Batch-call `get_user_info` (Connector B) for each unique author (max 5 calls)
> 3. Populate `author_followers` and `author_verified` from the `get_user_info` response
> 4. If `get_user_info` call fails, default to `author_followers: 0`, `author_verified: false`
>
> **CONNECTOR COST RULE:**
> Do NOT use Connector A `get_tweet` for individual tweet fetching. All individual tweet needs go through Connector B tools (`get_user_tweets`, `get_tweet_replies`, `get_tweet_thread`). Connector A `search_x` is restricted to last-resort Mode A fallback only.

#### 3.1.2 Kaito+B Normalization Path (Mode A Primary)

```
KAITO+B NORMALIZATION (PRIMARY for Mode A):

1. Kaito kaito_advanced_search returns results with:
   - url: "https://twitter.com/{user_id}/status/{tweet_id}"
   - engagement, smart_engagement, summary (metadata — NOT written to canonical schema)

2. Extract tweet_id from Kaito URL:
   - Regex: /status/(\d+)
   - Example: "https://twitter.com/Marczeller/status/1898852076380856586" → "1898852076380856586"

3. Fetch full tweet via Connector B:
   - get_tweet_thread(tweetId: "{tweet_id}")
   - Response: array of tweets (full thread). Extract the tweet where tweet.id == target_id
   - Typically the FIRST tweet in the response array, but ALWAYS match by ID
   - Discard all other tweets in the thread

4. Normalize extracted tweet using STANDARD Connector B path (Section 3.1 table):
   - All 23 canonical fields map identically to Connector B column
   - source_connector: "Kaito+B" (NOT "B" — distinguishes the Kaito-first pipeline)

5. Kaito bonus metadata (used for internal pipeline logic only):
   - smart_engagement → theme prioritization signal
   - summary → pre-Connector B triage (scan before fetching)
   - engagement → pre-filter before Connector B calls
   - These are NEVER written to daily_posts.json
```

---

## 4. Data File Schemas

### 4.1 `daily_posts.json` — Daily Topics + Thought Leaders Posts

**Written by**: Agent ② (daily)
**Read by**: Agent ③ (today's entries), Agent ④ (last 7 days)
**Persistence**: Append-only, date-keyed. New days append; existing days never modified.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "v3/schemas/daily_posts/v1",
  "title": "Daily Posts File",
  "type": "object",
  "description": "Top-level object keyed by date string (YYYY-MM-DD). Each date contains theme-grouped posts from that day's pull.",
  "patternProperties": {
    "^\\d{4}-\\d{2}-\\d{2}$": {
      "type": "object",
      "required": ["pull_timestamp", "account", "themes"],
      "properties": {
        "pull_timestamp":  { "type": "string", "format": "date-time", "description": "Exact time the pull completed" },
        "account":         { "type": "string", "description": "@handle this pull was for" },
        "total_posts":     { "type": "integer", "description": "Total posts retrieved across all modes" },
        "themes": {
          "type": "array",
          "description": "Posts clustered by theme",
          "items": {
            "type": "object",
            "required": ["theme_label", "source_mode", "signal_strength", "posts"],
            "properties": {
              "theme_label":     { "type": "string", "description": "Human-readable theme name (e.g., 'ETH restaking yield')" },
              "source_mode":     { "type": "string", "enum": ["topics", "thought-leaders"], "description": "Which pull mode sourced this theme" },
              "signal_strength":  { "type": "number", "minimum": 0, "maximum": 10, "description": "Composite signal score (0-10)" },
              "convergence_flag": { "type": "boolean", "description": "True if theme appears in BOTH topics and TL pulls with 3+ unique authors" },
              "unique_authors":  { "type": "integer", "description": "Number of distinct authors in this theme" },
              "posts": {
                "type": "array",
                "description": "Posts in this theme, sorted by signal score descending",
                "items": {
                  "type": "object",
                  "required": ["post_id", "text", "author_handle", "author_followers", "views", "likes", "replies", "retweets", "quotes", "bookmarks", "created_at", "url", "source_connector", "pull_date"],
                  "description": "Canonical post object (see Section 3)",
                  "$ref": "v3/schemas/canonical_post/v1"
                }
              }
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}
```

**Example structure:**
```json
{
  "2026-03-01": {
    "pull_timestamp": "2026-03-01T09:15:00Z",
    "account": "incyd__",
    "total_posts": 45,
    "themes": [
      {
        "theme_label": "ETH restaking yield",
        "source_mode": "topics",
        "signal_strength": 8.2,
        "convergence_flag": false,
        "unique_authors": 4,
        "posts": [
          {
            "post_id": "2027817148333089115",
            "text": "still manually searching for skills?...",
            "author_handle": "incyd__",
            "author_name": "Ash (🇺🇦,🤖)",
            "author_followers": 1580,
            "author_verified": true,
            "views": 164,
            "likes": 2,
            "replies": 2,
            "retweets": 0,
            "quotes": 0,
            "bookmarks": 3,
            "created_at": "2026-02-28T18:44:17Z",
            "url": "https://x.com/incyd__/status/2027817148333089115",
            "lang": "en",
            "is_reply": false,
            "in_reply_to_id": null,
            "conversation_id": "2027817148333089115",
            "has_quoted_tweet": false,
            "quoted_post_id": null,
            "is_retweet": false,
            "source_connector": "B",
            "pull_date": "2026-03-01"
          }
        ]
      }
    ]
  }
}
```

### 4.2 `own_posts.jsonl` — Environment_User's Own Posts History

**Written by**: Agent ② (daily, Mode C)
**Read by**: Agent ③ (last 7 days for context), Agent ④ (last 7 days for proposed vs actual)
**Persistence**: Append-only, one post per line, deduplicated by `post_id`.

**Schema per line** (each line is a standalone JSON object). This is a **subset** of the canonical post schema (Section 3) — own posts omit `author_handle`, `author_name`, `author_followers`, `author_verified`, `lang`, and `source_connector` because these are constant for the Environment_User's own account. Instead, it adds `is_thread` and `thread_position` fields specific to own-post tracking:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `post_id` | string | Yes | Unique tweet ID (primary key) |
| `text` | string | Yes | Full tweet text |
| `created_at` | string (ISO 8601) | Yes | When the Environment_User posted this |
| `views` | integer | Yes | Impression count at time of pull |
| `likes` | integer | Yes | Like count at time of pull |
| `replies` | integer | Yes | Reply count at time of pull |
| `retweets` | integer | Yes | Retweet count at time of pull |
| `quotes` | integer | Yes | Quote tweet count |
| `bookmarks` | integer | Yes | Bookmark count |
| `url` | string | Yes | x.com tweet URL |
| `is_reply` | boolean | Yes | Whether this is a reply |
| `in_reply_to_id` | string/null | Yes | Parent tweet ID if reply |
| `conversation_id` | string | Yes | Thread root ID |
| `has_quoted_tweet` | boolean | Yes | Whether this quotes another tweet |
| `quoted_post_id` | string/null | Yes | Quoted tweet ID if present |
| `is_thread` | boolean | Yes | Whether this is part of a multi-tweet thread by the same author |
| `thread_position` | integer/null | Yes | Position in thread (1-based) or null if not a thread |
| `pull_date` | string (YYYY-MM-DD) | Yes | Date this record was pulled |

**Example line:**
```jsonl
{"post_id":"2027817148333089115","text":"still manually searching for skills?...","created_at":"2026-02-28T18:44:17Z","views":164,"likes":2,"replies":2,"retweets":0,"quotes":0,"bookmarks":3,"url":"https://x.com/incyd__/status/2027817148333089115","is_reply":false,"in_reply_to_id":null,"conversation_id":"2027817148333089115","has_quoted_tweet":false,"quoted_post_id":null,"is_thread":false,"thread_position":null,"pull_date":"2026-03-01"}
```

> **Dedup rule**: Before appending, Agent ② checks if `post_id` already exists in the file. If yes, skip (do NOT update — metrics snapshots are point-in-time).

### 4.3 `analytics_history.jsonl` — Daily Analytics Log

**Written by**: Agent ③ (daily, one record per run)
**Read by**: Agent ④ (last 7 days)
**Persistence**: Append-only, one JSON object per line, one line per daily run.

**Schema per line:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | Yes | Date of the analytics run |
| `account` | string | Yes | @handle this run was for |
| `run_timestamp` | string (ISO 8601) | Yes | Exact time Agent ③ completed |
| `themes_analysed` | integer | Yes | Number of themes processed |
| `posts_processed` | integer | Yes | Total posts analysed |
| `themes` | array | Yes | Theme-level detail (see sub-schema) |
| `replies_generated` | integer | Yes | Total reply copies written |
| `avg_confidence` | number (1-10) | Yes | Average confidence score across all replies |
| `ctas_included` | integer | Yes | Number of replies that included a CTA |
| `own_post_recs` | integer | Yes | Number of own-post recommendations generated |
| `keywords_that_performed` | string[] | Yes | Keyword combos that returned high-signal posts |
| `keywords_with_no_signal` | string[] | Yes | Keyword combos that returned noise |
| `narrative_shifts_detected` | string[] | Yes | Free-text observations about changing narratives |
| `convergence_themes` | string[] | Yes | Themes that triggered convergence detection |
| `tavily_researches_run` | integer | Yes | Number of Tavily research calls made |
| `own_posts_context_window` | integer | Yes | Number of own posts loaded as context (last 7 days) |
| `angle_distribution` | object | Yes | Breakdown of reply angle sources (see sub-schema below) |

**Angle distribution sub-schema** (object in `angle_distribution`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cross_pollinated` | integer | Yes | Count of cross-pollinated replies |
| `own_perspective` | integer | Yes | Count of own-perspective replies |
| `research_informed` | integer | Yes | Count of research-informed replies |
| `cross_pollinated_pct` | number | Yes | Percentage (0-100) of cross-pollinated replies |
| `own_perspective_pct` | number | Yes | Percentage (0-100) of own-perspective replies |
| `research_informed_pct` | number | Yes | Percentage (0-100) of research-informed replies |

**Theme sub-schema** (items in `themes` array):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Theme label (matches `theme_label` in daily_posts.json) |
| `signal_strength` | number (0-10) | Yes | Composite signal score |
| `posts_count` | integer | Yes | Posts in this theme |
| `source_mode` | string | Yes | "topics" or "thought-leaders" |
| `top_angle` | string | Yes | Best engagement angle identified |
| `tavily_research_used` | boolean | Yes | Whether Tavily was called for this theme |
| `replies_written` | integer | Yes | Replies generated for this theme |
| `avg_theme_confidence` | number (1-10) | Yes | Average confidence for this theme's replies |
| `convergence_flag` | boolean | Yes | Inherited from daily_posts.json |

**Example line:**
```jsonl
{"date":"2026-03-01","account":"incyd__","run_timestamp":"2026-03-01T09:45:00Z","themes_analysed":5,"posts_processed":45,"themes":[{"name":"ETH restaking yield","signal_strength":8.2,"posts_count":5,"source_mode":"topics","top_angle":"contrarian: overcollateralisation risk","tavily_research_used":true,"replies_written":5,"avg_theme_confidence":7.8,"convergence_flag":false}],"replies_generated":45,"avg_confidence":7.1,"ctas_included":12,"own_post_recs":3,"keywords_that_performed":["restaking yield","eth vault"],"keywords_with_no_signal":["defi merge"],"narrative_shifts_detected":["restaking moving from yield focus to security focus"],"convergence_themes":[],"tavily_researches_run":3,"own_posts_context_window":12}
```

### 4.4 `engagement_replies.xlsx` — Engagement Spreadsheet

**Written by**: Agent ③ (daily, appended rows)
**Read by**: User (primary consumer), Agent ④ (weekly — columns 19-20 for reply adoption tracking)
**Persistence**: Append-only across days. New rows added per run, never overwrite existing rows.

**Column Schema (exact column order):**

| # | Column Header | Data Type | Source | Description |
|---|--------------|-----------|--------|-------------|
| 1 | Date | date (YYYY-MM-DD) | Agent ③ run date | Pull date |
| 2 | Theme | string | `daily_posts.json` → `themes[].theme_label` | Theme cluster label |
| 3 | Source | string ("topics" / "thought-leaders") | `daily_posts.json` → `themes[].source_mode` | Which pull mode |
| 4 | Original Post URL | URL string | `daily_posts.json` → `themes[].posts[].url` | Link to tweet |
| 5 | Author | string | `daily_posts.json` → `themes[].posts[].author_handle` | @handle |
| 6 | Author Followers | integer | `daily_posts.json` → `themes[].posts[].author_followers` | Follower count |
| 7 | Post Text | string | `daily_posts.json` → `themes[].posts[].text` | Full tweet text |
| 8 | Views | integer | `daily_posts.json` → `themes[].posts[].views` | Impression count |
| 9 | Likes | integer | `daily_posts.json` → `themes[].posts[].likes` | Like count |
| 10 | Replies | integer | `daily_posts.json` → `themes[].posts[].replies` | Reply count |
| 11 | Retweets | integer | `daily_posts.json` → `themes[].posts[].retweets` | Retweet count |
| 12 | Suggested Angle | string | Agent ③ analysis | Brief engagement strategy description |
| 13 | Reply Copy | string | Agent ③ content generation + humanizer | Ready-to-post reply in account's voice |
| 14 | Confidence Score | integer (1-10) | Agent ③ scoring | Relevance/quality rating |
| 15 | CTA Included | string ("Yes" / "No") | Agent ③ CTA rules | Whether a CTA was inserted |
| 16 | CTA Type | string / empty | Agent ③ CTA rules | Which CTA was used (blank if none) |
| 17 | Convergence | string ("Yes" / "No") | `daily_posts.json` → `themes[].convergence_flag` | Whether this theme is a convergence signal |
| 18 | Signal Strength | number (0-10) | `daily_posts.json` → `themes[].signal_strength` | Theme signal score |
| 19 | Post ID | string | `daily_posts.json` → `themes[].posts[].post_id` | Original post's unique ID — used by Agent ④ to match against `own_posts.jsonl.in_reply_to_id` for reply adoption tracking |
| 20 | Angle Source Mix | string | Agent ③ analysis | "cross-pollinated" / "own-perspective" / "research-informed" — tracks distribution against 70/20/10 target |

> **Data lineage**: Columns 1-11 + 17-19 are derived from `daily_posts.json` (Agent ② output). Columns 12-16, 20 are Agent ③ original analysis. This means the xlsx is a JOIN of Agent ②'s data and Agent ③'s intelligence.

> **Reply adoption tracking (added 2026-03-09)**: Column 19 (Post ID) enables Agent ④ to match suggested replies against actual user replies. When the Environment_User replies to a tweet, `own_posts.jsonl` records `in_reply_to_id` = the parent post's ID. Agent ④ matches `engagement_replies.xlsx.Post ID` against `own_posts.jsonl.in_reply_to_id` to determine which suggested replies the user actually posted, then tracks the reply's performance metrics.

### 4.5 `own_post_recs.xlsx` — Daily Own Post Recommendations

> **CHANGED (2026-03-05)**: Migrated from `own_post_recs.md` (markdown) to `own_post_recs.xlsx` (spreadsheet) for consistency with engagement_replies.xlsx and easier user review.

**Written by**: Agent ③ (daily, appended rows)
**Read by**: Agent ④ (weekly comparison), User (daily review)
**Persistence**: Append-only across days. New rows added per run, never overwrite existing rows.

**Column Schema (exact column order):**

| # | Column Header | Data Type | Source | Description |
|---|--------------|-----------|--------|-------------|
| 1 | Date | date (YYYY-MM-DD) | Agent ③ run date | Pull date |
| 2 | Theme | string | `daily_posts.json` → `themes[].theme_label` | Theme cluster label |
| 3 | Why Trending | string | Agent ③ analysis | 1-2 sentence explanation with evidence |
| 4 | Signal Strength | number (0-10) | `daily_posts.json` → `themes[].signal_strength` | Theme signal score |
| 5 | Source | string | `daily_posts.json` → `themes[].source_mode` | "topics" / "thought-leaders" / "convergence" |
| 6 | Convergence | string ("Yes"/"No") | `daily_posts.json` → `themes[].convergence_flag` | Convergence signal |
| 7 | Angle Source Mix | string | Agent ③ analysis | "cross-pollinated" / "own-perspective" / "research-informed" |
| 8 | Suggested Post | string | Agent ③ content generation + humanizer | Draft post copy in account's voice |
| 9 | Supporting Data Points | string | Agent ③ Tavily enrichment | 2-3 data points separated by newlines |
| 10 | Recommended Timing | string | Agent ③ analysis | Time window or "No timing signal detected" |
| 11 | Coverage Gap Days | integer | Agent ③ own_posts.jsonl cross-reference | Days since last post on this topic |
| 12 | Rec Score | number | Agent ③ Section 3.1 weighting | Computed recommendation score |

> **Data lineage**: Columns 1-2, 4-6 are derived from `daily_posts.json` (Agent ② output). Columns 3, 7-12 are Agent ③ original analysis.

> **Archival**: Before Agent ③ appends new rows, archive the current `own_post_recs.xlsx` to `weekly/own_post_recs_archive/YYYY-MM-DD_recs.xlsx` so Agent ④ can access the full week.

---

## 5. Agent Read/Write Contracts

### 5.1 Access Control Matrix

| File | Agent ① | Agent ② | Agent ③ | Agent ④ | User | Ad-Hoc |
|------|---------|---------|---------|---------|------|--------|
| `account_profile.md` | **CREATE** | READ | READ | READ + WRITE (keywords only) | READ + WRITE | READ |
| `daily_posts.json` | — | **APPEND** | READ (today) | READ (7 days) | — | READ |
| `own_posts.jsonl` | — | **APPEND** | READ (7 days) | READ (7 days) | — | — |
| `analytics_history.jsonl` | — | — | **APPEND** | READ (7 days) | — | — |
| `engagement_replies.xlsx` | — | — | **APPEND** | READ (7 days, cols 19-20) | READ | — |
| `own_post_recs.xlsx` | — | — | **APPEND** | READ (7 days) | READ | — |
| `web3_knowledge_base.md` | **SEED** | READ | READ | PROPOSE edits | APPROVE + EDIT | READ |
| `CLAUDE.md` | — | READ | READ | PROPOSE (learning log) | READ + EDIT (applies proposals) | READ |
| Kaito `kaito_advanced_search` | — | **READ** (Mode A primary) | — | — | — | — |
| `agent_2_log.txt` | — | **CREATE** | — | READ | — | — |
| `agent_3_log.txt` | — | — | **CREATE** | READ | — | — |
| `weekly/` (KB edit proposals, effectiveness reports, learning log proposals) | — | — | — | **CREATE** | READ + APPROVE | — |

Legend: **BOLD** = primary write responsibility. READ = read access. — = no access.

### 5.2 Pre-Read Validation Checks

Each agent MUST run these checks before reading its input files:

| Agent | Check | On Failure |
|-------|-------|-----------|
| Agent ② | `account_profile.md` exists and has non-empty `keyword_combos` and `thought_leaders` sections | ABORT — cannot run without profile |
| Agent ③ | `daily_posts.json` has entry for today's date | ABORT — daily pull hasn't run yet |
| Agent ③ | `own_posts.jsonl` exists (may be empty for first run) | WARN — proceed without own-post context |
| Agent ③ | `account_profile.md` has non-empty `voice_profile` section | ABORT — cannot generate on-voice content |
| Agent ④ | `analytics_history.jsonl` has ≥3 records in last 7 days | ABORT — insufficient data for weekly analysis |
| Agent ④ | `own_posts.jsonl` has records in last 7 days | WARN — proposed-vs-actual will be incomplete |
| Agent ④ | `own_post_recs.xlsx` archive has ≥3 days in last 7 | WARN — adoption analysis will be incomplete |

### 5.3 Post-Write Validation Checks

Each agent MUST validate after writing:

| Agent | Check | On Failure |
|-------|-------|-----------|
| Agent ② | `daily_posts.json` is valid JSON; today's date key exists; all posts have required fields | ROLLBACK — remove today's entry, alert user |
| Agent ② | `own_posts.jsonl` — last N lines are valid JSONL; no duplicate `post_id` values | ROLLBACK — remove duplicates |
| Agent ③ | `analytics_history.jsonl` — last line is valid JSON; has today's date; field count matches schema | ROLLBACK — remove last line, alert user |
| Agent ③ | `engagement_replies.xlsx` — new rows have all 20 columns; no empty Reply Copy cells | WARN — flag incomplete rows for review |
| Agent ④ | Weekly report files are valid Markdown with expected sections | WARN — user reviews regardless |

---

## 6. Cross-File Reference Map

These are the data lineage links between files. When Agent ④ compares "proposed vs actual", it needs to trace data across multiple files.

### 6.1 Theme Lineage (daily_posts → analytics_history → weekly report)

```
daily_posts.json                    analytics_history.jsonl              weekly report
─────────────────                   ──────────────────────               ─────────────
themes[].theme_label ──────────────▶ themes[].name ──────────────────▶  Theme frequency
themes[].signal_strength ──────────▶ themes[].signal_strength ────────▶ Signal trends
themes[].convergence_flag ─────────▶ themes[].convergence_flag ───────▶ Convergence patterns
themes[].source_mode ──────────────▶ themes[].source_mode ────────────▶ Source distribution
```

### 6.2 Proposed vs Actual Comparison (Agent ④)

```
own_post_recs.xlsx (archived)        own_posts.jsonl
──────────────────────────           ─────────────────
Theme 1: {theme_label}   ◄──compare──▶  post.text (semantic match)
  - Draft post copy       ◄──compare──▶  post.text (adoption check)
  - Signal strength        ◄──compare──▶  post.views, post.likes (performance)

Match categories:
  EXACT   = Environment_User posted content very similar to recommendation
  ADAPTED = Environment_User posted on same theme but different angle
  IGNORED = Recommendation had no matching post
  GAP     = Environment_User posted on topic NOT in recommendations
```

### 6.3 Keyword Performance Loop (Agent ④ → account_profile)

```
analytics_history.jsonl              account_profile.md
──────────────────────               ──────────────────
keywords_that_performed[] ──────────▶ keyword_combos (keep/promote)
keywords_with_no_signal[] ──────────▶ keyword_combos (demote/remove)
narrative_shifts_detected ──────────▶ topics (add emerging, remove fading)
```

---

## 7. Schema Evolution Rules

Following `design-serialization-schema` skill guidance:

| Change Type | Allowed? | Procedure |
|------------|----------|-----------|
| Add optional field | Yes | Add with sensible default. No version bump needed. |
| Add required field | No | NEVER — breaks existing data. Add as optional first, promote to required in v2. |
| Remove field | No | Deprecate by adding `_deprecated` suffix. Remove in next major version. |
| Rename field | No | Add new field, deprecate old. Both coexist until v2. |
| Change field type | No | Add new field with new type, deprecate old. |
| Add enum value | Yes | Consumers must handle unknown values gracefully. |
| Remove enum value | No | Deprecate, don't remove. |

**Version embedding**: Every data file includes a `pull_date` or `date` field that implicitly versions the schema (all records written after schema change date use the new format). If a breaking change is ever needed, bump the schema `$id` from `v1` to `v2` and update all agent configs simultaneously.

---

## 8. Signal Scoring Formula

Referenced by Agent ② (scoring) and Agent ③ (prioritization). Based on `x-mastery` engagement weights:

```
engagement_score = (replies × 27) + (retweets × 20) + (quotes × 24) + (likes × 1) + (bookmarks × 4)

signal_score = engagement_score / max(views, 1) × 1000

// Modifiers:
// +1.0 if author_verified = true
// +0.5 if author_followers > 10000
// +2.0 if convergence_flag = true
// Cap at 10.0
```

All agents that read `signal_strength` fields in `daily_posts.json` should expect values in the 0-10 range produced by this formula.

---

## 9. Timestamp Normalization Rules

All timestamps in V3 data files use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ` (no milliseconds)

| MCP Source | Raw Format Example | Normalization |
|-----------|-----------|--------------|
| Connector B `createdAt` (in Tweet) | `"Sat Feb 28 18:44:17 +0000 2026"` | Parse → `"2026-02-28T18:44:17Z"` |
| Connector A `created_at` (in Tweet) | `"2026-02-26T04:05:46.000Z"` | Strip ms → `"2026-02-26T04:05:46Z"` |
| Connector B `get_user_followers` `created_at` | Various ISO formats | Normalize to `YYYY-MM-DDTHH:MM:SSZ` |
| Connector B `get_trending_topics` `metadata.timestamp` | ISO 8601 | Pass through (metadata only, not stored) |
| Pull timestamps | Agent generates | Use `new Date().toISOString()` then strip ms |
| Date-only fields (`pull_date`, `date`) | N/A | `YYYY-MM-DD` format |

---

## 10. Validation Checklist (Pre-Build)

Before building any agent config, verify:

**Data Normalization:**
- [ ] Agent ② config references Section 3.1 normalization map (verified field paths for Connector A and B)
- [ ] Agent ② config handles Connector A nested `metrics.*` fields (not flat like Connector B)
- [ ] Agent ② config maps Connector A `tweet_url` → canonical `url` (not `urls` array)
- [ ] Agent ② config maps Connector A `username` → canonical `author_handle` (not `author_username`)
- [ ] Agent ② config includes Connector B `createdAt` parsing logic ("Sat Feb 28..." → ISO)
- [ ] Agent ② config strips milliseconds from Connector A `created_at` ("...000Z" → "Z")
- [ ] Agent ② config includes Connector A enrichment strategy (batch `get_user_info` for author metadata)

**Data Integrity:**
- [ ] Agent ② config enforces dedup by `post_id` before appending
- [ ] Agent ③ config references Section 4.4 xlsx column order (20 columns)
- [ ] Agent ③ config references Section 4.3 analytics_history schema
- [ ] Agent ④ config references Section 6.2 proposed-vs-actual matching logic
- [ ] Agent ④ config references Section 6.3 keyword performance loop
- [ ] All agent configs reference Section 5 access control matrix
- [ ] Orchestration layer implements Section 5.2 pre-read checks
- [ ] Orchestration layer implements Section 5.3 post-write checks
- [ ] Signal scoring formula (Section 8) is identical in Agent ② and Agent ③ configs

**MCP Tool Reliability & Connector Rules:**
- [ ] Agent ① does NOT depend on `search_users` (500 error) — uses `get_user_followers` + `get_user_info` fallback
- [ ] Agent ② does NOT depend on `get_tweet_thread` (500 error) — uses `get_tweet_replies` instead
- [ ] Agent ② does NOT use Connector A `get_tweet` — all individual tweet fetching via Connector B
- [ ] Kaito is PRIMARY for Agent ② Mode A, optional for Agents ①③④ — Agent ② checks Kaito availability at runtime, falls back to Connector B then Connector A if unavailable
- [ ] Kaito rate limit enforced: max 80 requests/day across all agents
- [ ] All agents use Tavily instance `f5b10baf` (primary) — NOT `a0103b84` (500 error)
- [ ] Agent configs include error handling for MCP 500 responses (skip source, continue pipeline)
- [ ] Section 2.8 tool availability matrix is referenced in all agent configs (note: `search_tweets` intermittent — last 500 error on 2026-03-05)
- [ ] Connector A restricted to `search_x` only (keyword search) — no `get_tweet`, no timeline pulls
