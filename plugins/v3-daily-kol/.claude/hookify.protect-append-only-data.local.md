---
name: protect-append-only-data
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: daily_posts\.json$|own_posts\.jsonl$|analytics_history\.jsonl$
---

**Append-only data file detected!**

The files `daily_posts.json`, `own_posts.jsonl`, and `analytics_history.jsonl` are append-only protected (CLAUDE.md Section 5.1).

**Allowed operations:**
- `daily_posts.json`: Append new date keys only. Never modify or delete historical entries.
- `own_posts.jsonl`: Append new lines only. Dedup by `post_id`. Never rewrite existing lines.
- `analytics_history.jsonl`: Append new daily records only. Never modify past records.

**If you need to write to these files**, use a bash append operation (`>>` or programmatic JSON append) rather than the Write/Edit tools, which replace content. The owning agent must handle appends via code that preserves existing data.
