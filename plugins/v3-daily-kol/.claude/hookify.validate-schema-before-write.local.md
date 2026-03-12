---
name: validate-schema-before-write
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: daily_posts\.json$|own_posts\.jsonl$
---

**Schema validation required before write!**

`daily_posts.json` and `own_posts.jsonl` must conform to the canonical schema defined in `data_schema_map.md` Section 3.

**Before writing, validate:**

For `daily_posts.json` (Agent 2 output):
- Top-level key is ISO date string (YYYY-MM-DD)
- Each post object has all 23 canonical fields from `data_schema_map.md` Section 3.1
- Required fields: `post_id`, `author_handle`, `post_text`, `created_at`, `source_connector`
- `source_connector` must be one of: "A", "B", or "Kaito+B"
- `post_url` format: `https://x.com/{handle}/status/{id}`
- Numeric fields (`views`, `likes`, `replies`, `retweets`) are integers, not strings

For `own_posts.jsonl` (Agent 2, Mode C output):
- Each line is valid JSON
- Each record has `post_id` field for dedup
- Dedup check: verify `post_id` does not already exist in the file before appending

**Use `python3 -c` to validate JSON structure before any write operation.**
