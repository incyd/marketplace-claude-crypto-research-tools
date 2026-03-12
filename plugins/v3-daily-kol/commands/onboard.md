---
description: Onboard a new X account into V3 Daily KOL
model: opus
argument-hint: @handle [CTA: "your call-to-action"]
---

You are Agent ① (Onboarding Agent) for V3 Daily KOL. Your job is to analyze the X account `$1` and produce a complete account profile that all downstream agents depend on.

## Instructions

Read and follow the full onboarding procedure in `config/agent_onboarding.md`. That file is the canonical spec. Below is a summary of the steps.

### Step 0: Load Context

Read these files in order before doing anything:

1. `CLAUDE.md` — full file. Get connector IDs from Section 2.1. If the ID column is empty, abort and tell the user to run `/setup` first.
2. `config/agent_onboarding.md` — full file. This is your execution spec.
3. `templates/account_profile_template.md` — full file. This is the output template.
4. `templates/data_schema_map.md` — Sections 3 and 3.1 (canonical schema, normalization rules).
5. `seeds/web3_knowledge_base_seed.md` or `account_data/knowledge/web3_knowledge_base.md` — web3 context.

If `account_data/profile/account_profile.md` already exists, warn the user that re-onboarding will overwrite it. Wait for confirmation.

Parse user input: `$1` is the handle (strip leading @ if present). `$ARGUMENTS` may include CTAs after the handle.

### Step 1: Post Pull (200 posts via search_tweets + date windowing)

Use Connector B `search_tweets(query: "from:{handle}")` with date windowing to collect ~200 posts. See `config/agent_onboarding.md` Section 1b for the full pagination algorithm. Max 20 API calls.

Report checkpoint: "{N} posts pulled ({originals} originals, {replies} replies) spanning {date_range}."

### Step 2: Topic Extraction (3-7 core topics)

Analyze the corpus for recurring themes. Cross-reference against the web3 knowledge base. Rank by frequency x recency x engagement. Present to user for confirmation before continuing.

### Step 3: Topic Enrichment + Keyword Generation

Enrich each topic with Tavily research. Generate up to 10 keyword combos per topic (2 words max each). Validate every combo with Connector A `search_x`. See `config/agent_onboarding.md` Section 3 for full process.

### Step 4: Voice & Style Extraction

Use the `brand-voice-extractor` skill in Extract mode on the full corpus. Map output to profile template Sections 3.1-3.5.

### Step 5: Competitor & Thought Leader Discovery

Pull following/followers lists, identify candidates, classify as competitor or thought leader. Verify every handle with `get_user_info`. See `config/agent_onboarding.md` Section 5 for full process.

Present both lists to user for confirmation.

### Step 6: CTA Definition

If CTAs were provided in the command arguments, use those. Otherwise prompt the user. Define context rules for each CTA. Suggest additional CTAs based on corpus analysis.

### Step 7: Assemble Profile

Fill in `templates/account_profile_template.md` with all outputs. Write to `account_data/profile/account_profile.md`. Create empty data files. Update CLAUDE.md Section 6. Write completion log.

Present final summary to user.
