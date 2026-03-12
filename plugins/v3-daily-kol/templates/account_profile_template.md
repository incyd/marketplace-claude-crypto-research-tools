# Account Profile: @{account_handle}

> **Created**: {date}
> **Last updated**: {date}
> **Onboarded by**: Agent ① (Opus 4.6)
> **Posts analysed**: {count} posts from @{account_handle}

---

## 1. Account Overview

| Field | Value |
|-------|-------|
| **Handle** | @{account_handle} |
| **Display Name** | {display_name} |
| **Followers** | {follower_count} |
| **Following** | {following_count} |
| **Bio** | {bio_text} |
| **Verified** | {yes/no} |
| **Primary Language** | {lang} |
| **Account Focus** | {1-sentence summary of what this Environment_User is about} |

---

## 2. Topics

Each topic represents a core subject area the Environment_User engages with. Topics are extracted from the post corpus during onboarding (Step 2) and enriched with web3 context (Step 3).

### 2.1 Topic: {topic_name_1}

- **Description**: {2-3 sentence description of this topic area and its relevance to the Environment_User}
- **Web3 Context**: {enrichment from Tavily — current state of this narrative, key projects, recent developments}
- **Confidence**: {high/medium/low — based on how frequently this topic appears in the post corpus}

**Keyword Combinations** (max 10 per topic, 2 words max each):

| # | Keyword Combo | Validated | Notes |
|---|--------------|-----------|-------|
| 1 | {word1 word2} | {yes/no — tested via Connector A search_x} | {e.g., "returns high-signal posts", "too broad", "niche but relevant"} |
| 2 | {word1 word2} | {yes/no} | |
| 3 | {word1 word2} | {yes/no} | |

> **Validation rule**: Each keyword combo is tested via `search_x` (Connector A) during onboarding. Combos that return irrelevant or zero results are flagged and replaced. Only validated combos are used by Agent ② for daily topic pulls.

### 2.2 Topic: {topic_name_2}

{Same structure as 2.1}

### 2.N Topic: {topic_name_N}

{Same structure as 2.1}

---

## 3. Voice & Style Profile

> Extracted from the 200-post corpus using `brand-voice-extractor` (Extract mode) during onboarding Step 4. This section is the primary reference for Agent ③ when generating engagement content.

### 3.1 Personality Traits

| Trait | Score (1-10) | Evidence |
|-------|-------------|----------|
| {e.g., Technical depth} | {score} | {example from posts} |
| {e.g., Conversational warmth} | {score} | {example from posts} |
| {e.g., Contrarian edge} | {score} | {example from posts} |

### 3.2 Tone Spectrum

- **Default tone**: {e.g., "Informed but approachable — explains complex DeFi concepts without condescension"}
- **When agreeing**: {e.g., "Adds a layer of nuance rather than simple agreement"}
- **When disagreeing**: {e.g., "Direct but respectful — leads with data"}
- **When excited**: {e.g., "Short punchy sentences, rhetorical questions"}

### 3.3 Vocabulary Guide

**Preferred terms**: {list of terms the Environment_User uses frequently — e.g., "infra" not "infrastructure", "degen" not "speculative trader"}

**Avoided terms**: {terms the Environment_User never uses — e.g., never says "WAGMI", avoids "to the moon"}

**Signature phrases**: {any recurring phrases or patterns — e.g., frequently starts threads with "Okay, let's talk about..."}

### 3.4 Rhythm & Structure Patterns

- **Typical tweet length**: {e.g., "Medium (150-240 chars) — rarely uses full 280"}
- **Thread frequency**: {e.g., "2-3 threads per week, usually 5-8 tweets long"}
- **Punctuation style**: {e.g., "Em dashes over commas, no Oxford comma, minimal exclamation marks"}
- **Emoji usage**: {e.g., "Rare — occasionally 🔑 or 🧵 for threads, never 🚀"}
- **Hashtag usage**: {e.g., "Never uses hashtags in regular tweets, only in thread openers"}

### 3.5 Content Formatting

- **Media usage**: {e.g., "Frequent screenshots of charts/dashboards, occasional memes"}
- **Link sharing**: {e.g., "Links in thread finales only, never in standalone tweets"}
- **Quote tweet style**: {e.g., "Adds 1-2 sentences of analysis, never just 'This.'"}

---

## 4. Competitors & Thought Leaders

### 4.1 Competitors

Accounts operating in the same niche and targeting similar audiences. Identified during onboarding Step 6.

| Handle | Focus Area | Overlap With Environment_User | Follower Count | Notes |
|--------|-----------|------------------------|---------------|-------|
| @{handle} | {their focus} | {shared topics} | {count} | {e.g., "Direct competitor in restaking narrative"} |

### 4.2 Thought Leaders to Track

These accounts are monitored daily by Agent ② (Mode B). Their posts feed into the engagement pipeline.

| Handle | Focus Area | Why We Track Them | Follower Count |
|--------|-----------|-------------------|---------------|
| @{handle} | {their focus} | {e.g., "Consistently surfaces early alpha on L2s"} | {count} |

> **Daily pull scope**: Agent ② pulls the last 24 hours of posts from every account listed in Section 4.2. Budget: 1 `get_user_tweets` call per TL, up to 5 posts per TL after freshness and noise filtering.

---

## 5. CTAs (Calls to Action)

### 5.1 Primary CTAs

CTAs provided by the user during onboarding Step 7. Agent ③ integrates these into engagement content only where contextually appropriate.

| # | CTA | Context Rule | Example Usage |
|---|-----|-------------|---------------|
| 1 | {e.g., "Check out our protocol at example.xyz"} | {e.g., "Only when replying to posts about yield optimization or restaking"} | {e.g., "Great point on yield strategies — we've been building exactly this at example.xyz"} |
| 2 | {e.g., "Join our Discord for alpha"} | {e.g., "Only in threads or quote tweets, never in simple replies"} | |

### 5.2 Agent-Suggested CTAs

Additional CTAs suggested by Agent ① based on post analysis. User must approve before they're activated.

| # | CTA | Rationale | Approved |
|---|-----|-----------|----------|
| 1 | {suggested CTA} | {why the agent suggests this — e.g., "Environment_User frequently discusses topic X, natural CTA opportunity"} | {yes/no/pending} |

### 5.3 CTA Rules

- **Confidence threshold**: CTA is only included when reply confidence score ≥ 7 AND the post topic matches a CTA's context rule
- **Frequency cap**: Maximum 1 CTA per 5 engagement replies (avoid appearing salesy)
- **Format**: CTAs are woven into the reply naturally, never appended as a separate sentence
- **Never in**: Disagreement replies, condolence/support replies, purely technical corrections

---

## 6. Onboarding Metadata

| Field | Value |
|-------|-------|
| **Posts pulled** | {count} (via Connector B `search_tweets` with `from:{handle}` + date windowing) |
| **Date range covered** | {earliest_post_date} — {latest_post_date} |
| **Topics extracted** | {count} topics with {total_keyword_combos} keyword combos |
| **Keywords validated** | {validated_count}/{total_count} passed `search_x` validation |
| **Voice extraction method** | `brand-voice-extractor` Extract mode |
| **Competitors identified** | {count} accounts |
| **Thought leaders identified** | {count} accounts |
| **CTAs defined** | {user_count} user-provided + {agent_count} agent-suggested |
| **Kaito data used** | {yes/no — whether Kaito was available during onboarding} |

---

## 7. Change Log

| Date | Changed By | Section | Change Description |
|------|-----------|---------|-------------------|
| {date} | Agent ① | All | Initial profile creation |
| {date} | {user/agent} | {section} | {description} |
