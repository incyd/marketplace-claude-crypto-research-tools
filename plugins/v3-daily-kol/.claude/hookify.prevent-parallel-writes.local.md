---
name: prevent-parallel-writes
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: daily_posts\.json|own_posts\.jsonl|analytics_history\.jsonl|engagement_replies\.xlsx|own_post_recs\.xlsx
---

**Shared data file write detected!**

This file is accessed by multiple agents across the pipeline. Concurrent writes can cause data corruption or loss.

**Sequential pipeline order (CLAUDE.md Section 3):**
1. Agent 2 writes `daily_posts.json` and `own_posts.jsonl`
2. Agent 3 reads Agent 2 output, writes `engagement_replies.xlsx` and `own_post_recs.xlsx`
3. Agent 4 reads all outputs, writes `analytics_history.jsonl`

**Before writing**, confirm:
- The upstream agent has completed its run for today
- No other agent is currently writing to this file
- You are the designated owner for this file (see `enforce-file-ownership` rule)

If agents run sequentially as designed, this warning is informational. If you see this during a parallel run, STOP and fix the execution order.
