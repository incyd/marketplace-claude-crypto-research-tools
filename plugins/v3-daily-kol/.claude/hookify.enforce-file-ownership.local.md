---
name: enforce-file-ownership
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: account_data/
---

**File ownership check required!**

All files under `account_data/` have designated owner agents (CLAUDE.md Section 5). Verify you are the correct owner before writing.

**Ownership map:**
- `account_data/profile/account_profile.md` -- Owner: Agent 1 (onboarding)
- `account_data/data/daily_posts.json` -- Owner: Agent 2 (daily pull)
- `account_data/data/own_posts.jsonl` -- Owner: Agent 2 (daily pull, Mode C)
- `account_data/analytics/analytics_history.jsonl` -- Owner: Agent 4 (weekly analytics)
- `account_data/knowledge/web3_knowledge_base.md` -- Owner: Agent 4 (proposes only, user approves)
- `account_data/output/engagement_replies.xlsx` -- Owner: Agent 3 (analytics)
- `account_data/output/own_post_recs.xlsx` -- Owner: Agent 3 (analytics)
- `account_data/logs/agent_*_log.txt` -- Owner: Each respective agent
- `account_data/weekly/**` -- Owner: Agent 4 (weekly learning)

**If you are not the designated owner**, stop and verify the operation is correct. Cross-agent writes indicate a pipeline error.
