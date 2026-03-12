---
name: protect-claude-md-structure
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: CLAUDE\.md$
---

**CLAUDE.md is structurally protected!**

CLAUDE.md Sections 1-6 are immutable after setup (CLAUDE.md Section 5.1). Direct edits are blocked.

**How updates work:**
- **Sections 1-6**: Only modified by the user during setup or manual maintenance. Agents never write here.
- **Section 7 (Learning Log)**: Agent 4 proposes entries via `weekly/claude_md_proposals/YYYY-WNN_learning_log.md`. The user reviews proposals and applies approved entries manually.

**If you are Agent 4**: Write your proposals to `account_data/weekly/claude_md_proposals/` instead. Do NOT edit CLAUDE.md directly.

**If you are running /setup**: This rule should be temporarily disabled during environment initialization. Use `/hookify:configure` to toggle.
