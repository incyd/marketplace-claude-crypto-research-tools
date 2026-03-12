# Alignment Check Protocol

> **When to run**: After any structural change to the v3 docs (new sections, renamed terms, schema updates, agent config rewrites). Also recommended as a periodic health check between development phases.
>
> **How to run**: Walk through each check category in order. For each check, mark PASS / FAIL / N/A. If FAIL, note the discrepancy and fix before moving to the next category. The categories are ordered from foundational (vocabulary) to derived (data fields) so that upstream fixes cascade down.

---

## 1. Vocabulary Consistency

**Source of truth**: `V3_ARCHITECTURE.md` Section 2 (Vocabulary)

| # | Check | How to verify |
|---|-------|--------------|
| 1.1 | Every term in the Vocabulary section is used consistently across all docs | Grep each defined term across `config/`, `templates/`, `CLAUDE.md`, `V3_ARCHITECTURE.md`. Flag any doc that uses a synonym or older variant (e.g., "KOL" instead of "Environment_User", "the account's voice" instead of "the Environment_User's voice"). |
| 1.2 | No doc introduces a new concept without it being defined in the Vocabulary | Scan all docs for terms that carry specific meaning but aren't in the Vocabulary. Candidates: anything that appears in **bold** or backticks that functions as a named concept. |
| 1.3 | "the user" is used ONLY for the human operator (checkpoint instructions, approval gates) — never to mean the Environment_User | Grep `the user` across all config and template docs. Each hit should be in the context of operator interaction (e.g., "present to the user", "the user reviews"). |
| 1.4 | "the account" is used ONLY when referring to the X/Twitter account object — never as a synonym for Environment_User | Grep `the account` variants. Acceptable: "account profile" (document name), "account_data" (folder), "account_handle" (variable). Flag: "the account's voice", "this account engages with". |

---

## 2. Document Registry

**Purpose**: Ensure every doc is tracked, has a clear owner, and serves a defined role.

### 2.1 Core Document Manifest

| Document | Purpose | Owner | Referenced By |
|----------|---------|-------|--------------|
| `V3_ARCHITECTURE.md` | System architecture, vocabulary, implementation plan | Project-level | All docs |
| `CLAUDE.md` | Runtime instructions loaded by every agent | Project-level (Agent ④ proposes Section 7 updates; user applies) | All agents at startup |
| `config/agent_onboarding.md` | Agent ① full instructions (direct execution) | Agent ① | V3_ARCHITECTURE, CLAUDE.md |
| `agents/agent-daily-pull.md` | Agent ② full instructions (v3.1 PRIMARY, subagent) | Agent ② | orchestrators/daily-pipeline.md, CLAUDE.md |
| `agents/agent-analytics.md` | Agent ③ full instructions (v3.1 PRIMARY, subagent) | Agent ③ | orchestrators/daily-pipeline.md, CLAUDE.md |
| `agents/agent-weekly-learning.md` | Agent ④ full instructions (v3.1 PRIMARY, subagent) | Agent ④ | orchestrators/weekly-learning.md, CLAUDE.md |
| `config/agent_daily_pull.md` | ARCHIVE (v3.0) — Agent ② historical reference | — | — |
| `config/agent_analytics.md` | ARCHIVE (v3.0) — Agent ③ historical reference | — | — |
| `config/agent_weekly_learning.md` | ARCHIVE (v3.0) — Agent ④ historical reference | — | — |
| `orchestrators/daily-pipeline.md` | Daily orchestrator — spawns Agent ② then ③ as subagents | Scheduled task | CLAUDE.md Section 1.5 |
| `orchestrators/weekly-learning.md` | Weekly orchestrator — spawns Agent ④ as subagent | Scheduled task | CLAUDE.md Section 1.5 |
| `config/mcp_setup_guide.md` | Connector installation and verification | Operator | CLAUDE.md, commands/setup.md |
| `config/alignment_check_protocol.md` | This document — consistency verification | Operator | — |
| `commands/setup.md` | `/setup` command — first-run initialisation | Operator | CLAUDE.md |
| `commands/onboard.md` | `/onboard` command — account onboarding | Operator | CLAUDE.md |
| `templates/account_profile_template.md` | Profile structure for Agent ① output | Agent ① | agent_onboarding.md |
| `templates/data_schema_map.md` | All data schemas, field definitions, validation rules | All agents | All agent configs, CLAUDE.md |
| `seeds/web3_knowledge_base_seed.md` | Initial knowledge base content | setup.md | commands/setup.md |
| `account_data/profile/account_profile.md` | Live instance profile (created from template) | Agent ① (created), all agents (read) | All agent configs |
| `account_data/knowledge/web3_knowledge_base.md` | Live knowledge base (seeded, evolved by Agent ④) | Agent ④ | agents/agent-analytics.md, agents/agent-weekly-learning.md |

| # | Check | How to verify |
|---|-------|--------------|
| 2.1 | Every file in the manifest physically exists | `ls` each path. |
| 2.2 | No orphaned docs exist in `config/`, `templates/`, `commands/`, `agents/`, or `orchestrators/` | List all .md files in these folders. Every file must appear in the manifest above. |
| 2.3 | Every "Referenced By" link is real | For each doc, grep for its filename or key section references in the listed referencing docs. |
| 2.4 | No doc duplicates the purpose of another | Review the Purpose column. Flag any overlap (e.g., schema defined in both CLAUDE.md and data_schema_map.md should cross-reference, not duplicate). |
| 2.5 | `agents/` directory contains all 3 agent files with v3.1 headers | Verify `agents/agent-daily-pull.md`, `agents/agent-analytics.md`, `agents/agent-weekly-learning.md` exist and each contains "v3.1 Execution Model" header block. |

---

## 3. Cross-Document References

| # | Check | How to verify |
|---|-------|--------------|
| 3.1 | All file paths referenced in docs match actual folder structure | Grep for `account_data/`, `config/`, `templates/`, `seeds/`, `commands/` paths across all docs. Verify each path exists. Flag any bare `knowledge/` not prefixed by `account_data/` — the knowledge base lives at `account_data/knowledge/`, not at root. |
| 3.2 | All section cross-references point to correct section numbers | Grep for `Section \d` across all docs. For each reference, verify the target doc's section numbering hasn't changed. Pay special attention to V3_ARCHITECTURE.md (11 sections) and data_schema_map.md (10 sections). |
| 3.3 | Agent config docs reference the correct CLAUDE.md sections | Each agent config's "Step 0" should reference `CLAUDE.md Section 1.4` (Context Manifest). Verify the manifest section number is current. |
| 3.4 | Template sections match profile sections | `templates/account_profile_template.md` section numbers (1–7) must match what `agent_onboarding.md` references when building the profile. |

---

## 4. MCP & Connector Alignment

**Source of truth**: `CLAUDE.md` Section 2 (MCP Tool Rules) + `V3_ARCHITECTURE.md` Section 3 (MCP Tool Inventory)

| # | Check | How to verify |
|---|-------|--------------|
| 4.1 | Connector A, B, and Kaito tool lists match across all docs | Compare tool lists in: V3_ARCHITECTURE.md Section 3, CLAUDE.md Section 2.2, mcp_setup_guide.md, and each agent config's MCP tools section. All must list the same tools for each connector, including Kaito `kaito_advanced_search` for Agent ②. |
| 4.2 | Connector allocation rules are consistent (Kaito-first) | CLAUDE.md Section 2.1, data_schema_map.md Section 1, and agent_daily_pull.md Section 1 must agree: Kaito is PRIMARY for Mode A keyword search, Connector B `search_tweets` is Fallback Tier 1, Connector A `search_x` is LAST RESORT Fallback Tier 2. |
| 4.3 | Sort parameters are consistent across tiers | Kaito: `sort_by: "engagement"` everywhere. Connector A fallback: `sort: "impressions"` everywhere — never `"likes"`. |
| 4.4 | Tavily connector status is consistent | Agent configs must reference Tavily as mandatory (Agent ③) or optional, matching V3_ARCHITECTURE.md. Verify the correct Tavily connector ID is in CLAUDE.md Section 2.1. |
| 4.5 | Kaito is REQUIRED for Agent ② Mode A, optional for others | Agent ② config (agent_daily_pull.md) must treat Kaito as PRIMARY for Mode A. CLAUDE.md Section 2.2 must list Kaito in Agent ② tool matrix. For Agents ①③④, Kaito remains optional ("if available" guards). Rate limit (80 req/day) must be consistent across all docs. |
| 4.6 | No doc references a deprecated or broken connector/tool | Check for any references to Connector A `get_profile` or `get_thread` (both return 500 errors). These should only appear in V3_ARCHITECTURE.md as documentation, never in agent instructions. |
| 4.7 | Kaito `kaito_advanced_search` parameters are consistent | All docs referencing Kaito Mode A calls must use: `author_type: "Individual"`, `sort_by: "engagement"`, `sources: "Twitter"`, `min_created_at` (24h window), `size: 20`. Check CLAUDE.md Section 2.1 hard rules, agent_daily_pull.md Section 1.3, data_schema_map.md Section 1. |
| 4.8 | `source_connector` enum includes `"Kaito+B"` in all schema docs | Verify the enum is `"A"`, `"B"`, `"Kaito+B"` in: CLAUDE.md Section 4.1, data_schema_map.md Section 3 (canonical schema), agent_daily_pull.md Section 4.1 (validation). |

---

## 5. Data Schema Alignment

**Source of truth**: `templates/data_schema_map.md`

| # | Check | How to verify |
|---|-------|--------------|
| 5.1 | Canonical post schema (data_schema_map Section 3) field names match what agent configs reference | Grep field names used in agent_daily_pull.md and agent_analytics.md. Every field name must exactly match the canonical schema. |
| 5.2 | `daily_posts.json` schema (data_schema_map Section 4.1) matches what Agent ② writes and Agent ③ reads | Verify Agent ②'s output format in agent_daily_pull.md matches the schema. Verify Agent ③'s input expectations in agent_analytics.md match the same schema. |
| 5.3 | `own_posts.jsonl` schema (data_schema_map Section 4.2) matches Mode C output | Agent ② Mode C output format must match the 15-field own_posts schema. |
| 5.4 | `analytics_history.jsonl` schema (data_schema_map Section 4.3) matches Agent ③ output | Verify all 16 required fields are referenced in agent_analytics.md output section. |
| 5.5 | `engagement_replies.xlsx` columns (data_schema_map Section 4.4) match Agent ③ spreadsheet output | Column names, order, and descriptions must match between data_schema_map and agent_analytics.md. |
| 5.6 | `own_post_recs.xlsx` columns (data_schema_map Section 4.5) match Agent ③ spreadsheet output | Column names, order (12 columns), and descriptions must match between data_schema_map and agent_analytics.md. |
| 5.7 | Signal scoring formula is consistent | Compare data_schema_map Section 8 with CLAUDE.md Section 4.2. Same formula, same weights, same field references. |

---

## 6. Agent Config Internal Consistency

> **v3.1 Note**: For Agents ②③④, check the PRIMARY configs in `agents/` (not the archive copies in `config/`).

| # | Check | How to verify |
|---|-------|--------------|
| 6.1 | Each agent config's "Step 0" loads the correct context | Compare what each agent loads (per its config in `agents/`) against CLAUDE.md Section 1.4 (Context Manifest). Must match exactly. Agent ① checks `config/agent_onboarding.md`. |
| 6.2 | File ownership in CLAUDE.md Section 3.1 matches what agents actually write to | For each agent config, list every file it writes to. Cross-reference against the ownership matrix. No agent should write to a file it doesn't own. |
| 6.3 | Append-only protections in CLAUDE.md Section 5.1 match agent behaviour | Verify no agent config instructs overwriting a protected file (daily_posts.json, own_posts.jsonl, analytics_history.jsonl). |
| 6.4 | Rate limits in CLAUDE.md Section 2.3 match agent config budgets | search_x call count, get_user_tweets per-TL limits, Tavily query budgets — all must be consistent between CLAUDE.md and the relevant agent config. |
| 6.5 | Agent model assignments match V3_ARCHITECTURE.md Section 1 and CLAUDE.md Section 1.5 | Agent ① = Opus, Agent ② = Sonnet, Agent ③ = Opus, Agent ④ = Opus. Verify no doc contradicts this. Verify orchestrator prompts specify correct model for each agent. |

---

## 7. Account Profile Template ↔ Agent Instructions

| # | Check | How to verify |
|---|-------|--------------|
| 7.1 | Every section in `account_profile_template.md` is populated by a specific onboarding step | Map template Sections 1–7 to agent_onboarding.md steps. Every section must have a corresponding step. No template section should be orphaned. |
| 7.2 | Agent ③ references the correct profile sections for voice, topics, CTAs | agent_analytics.md must reference: Section 2 (Topics), Section 3 (Voice Profile), Section 4.2 (TLs), Section 5 (CTAs). Verify section numbers match the template. |
| 7.3 | Agent ② references the correct profile sections for keyword combos and TL list | agent_daily_pull.md must reference: Section 2 keyword combos (Mode A), Section 4.2 TL handles (Mode B), Section 1 handle (Mode C). |
| 7.4 | Competitor/TL table columns in the template match what onboarding writes | Column headers in template Section 4.1 and 4.2 must match the fields agent_onboarding.md produces. |

---

## 8. Terminology Regression Check

| # | Check | How to verify |
|---|-------|--------------|
| 8.1 | Zero occurrences of "KOL" (except intentional historical notes) | `grep -ri "KOL" --include="*.md"` across the entire v3 folder. Only allowed: the historical note in Orchestration_Enforcement_Strategy.md. |
| 8.2 | Zero occurrences of "account owner" | `grep -ri "account owner" --include="*.md"`. Should return 0 results. |
| 8.3 | Zero occurrences of "Our Account" | `grep -ri "Our Account" --include="*.md"`. Should return 0 results. |
| 8.4 | Zero occurrences of `sort: "likes"` in search_x context | `grep -ri "likes" --include="*.md"` near `search_x` or `sort`. Should be `"impressions"` everywhere. Note: `search_x` is now fallback-only — verify it's never referenced as primary. |
| 8.5 | No "the account's" used to mean Environment_User | `grep -r "the account's" --include="*.md"`. Acceptable only if referring to the X account object (e.g., "the account's following list" in API context). Flag any that mean the Environment_User's attributes. |

---

## 9. Folder Structure Integrity

**Source of truth**: `V3_ARCHITECTURE.md` Section 6 (File & Folder Structure)

| # | Check | How to verify |
|---|-------|--------------|
| 9.1 | All directories listed in the architecture doc exist | `ls` each expected directory: `agents/`, `orchestrators/`, `config/`, `templates/`, `seeds/`, `commands/`, `account_data/`, `account_data/profile/`, `account_data/data/`, `account_data/knowledge/`, `account_data/output/`. |
| 9.2 | No unexpected directories exist | List all directories. Flag any not in the architecture doc (e.g., leftover `accounts/` from earlier restructure). `agents/` and `orchestrators/` are expected in v3.1. |
| 9.3 | Seed files exist for first-run | `seeds/web3_knowledge_base_seed.md` must exist. `commands/setup.md` must reference it. |
| 9.4 | Data files are in the correct locations | `daily_posts.json` in `account_data/data/`, `own_posts.jsonl` in `account_data/data/`, etc. Match against data_schema_map Section 4 file paths. |

---

## 10. Handoff & Pipeline Continuity

| # | Check | How to verify |
|---|-------|--------------|
| 10.1 | Agent ② output format matches Agent ③ input expectations | Agent ② writes `daily_posts.json` and `own_posts.jsonl`. Agent ③'s config must describe reading these exact files with the exact schema. |
| 10.2 | Agent ③ output format matches Agent ④ input expectations | Agent ③ writes `analytics_history.jsonl`, `engagement_replies.xlsx`, `own_post_recs.xlsx`. Agent ④'s config must describe reading from all three: analytics_history (7-day window), engagement_replies (Post ID + Angle Source Mix for reply adoption tracking), own_post_recs (adoption comparison). Agent ④ also reads `agent_2_log.txt` and `agent_3_log.txt`. |
| 10.3 | Agent ④ output targets are correct | Agent ④ writes proposals to: `weekly/knowledge_edit_proposals/` (KB edits), `weekly/claude_md_proposals/` (learning log), `weekly/effectiveness_reports/` (report). It does NOT write directly to `web3_knowledge_base.md` or `CLAUDE.md`. Both must be documented as PROPOSE-only in CLAUDE.md Section 3.1 ownership matrix. |
| 10.4 | Handoff contracts in CLAUDE.md Section 3.2 match actual agent behaviour | Each contract (② → ③, ③ → ④) must describe the exact files passed and the validation the receiving agent/orchestrator performs. |
| 10.5 | Orchestrator completeness — daily and weekly orchestrators define spawn logic, validation gates, error handling | Read `orchestrators/daily-pipeline.md` and `orchestrators/weekly-learning.md`. Each must: (a) read CLAUDE.md, (b) run pre-flight checks, (c) read agent config from `agents/`, (d) spawn via Agent tool with correct model, (e) validate output files, (f) write orchestrator log. |
| 10.6 | Model consistency — Agent ② = sonnet, ③④ = opus enforced in orchestrator prompts | Grep orchestrator files for model assignments. Verify they match CLAUDE.md Section 1.5 and the v3.1 headers in `agents/*.md`. |

---

## 11. New Additions Discovery

> **Purpose**: Catch anything introduced during development that hasn't been propagated across all relevant docs, instructions, and systems. This section runs as a diff against the known baseline — if something new exists but isn't reflected everywhere it should be, it shows up here.

### 11a. New Terminology

| # | Check | How to verify |
|---|-------|--------------|
| 11.1 | Scan all docs for **bold** or `backtick` terms that function as named concepts but don't appear in V3_ARCHITECTURE.md Section 2 (Vocabulary) | Grep for `\*\*[A-Z]` and backtick patterns across config/, templates/, CLAUDE.md. Cross-reference each against the Vocabulary table. Any missing = candidate for addition. |
| 11.2 | Check agent configs for locally-defined terms not in the vocabulary | Each agent config may introduce shorthand (e.g., "qualifying ratio", "noise flag", "angle source mix"). Verify these are either in the Vocabulary or are purely local to that one doc with no cross-doc usage. |

### 11b. New Data Sources & Connectors

| # | Check | How to verify |
|---|-------|--------------|
| 11.3 | Any MCP connector available in the runtime environment that isn't documented | Compare the live MCP connector list (from `/setup` output or CLAUDE.md Section 2.1) against V3_ARCHITECTURE.md Section 3 and mcp_setup_guide.md. Flag undocumented connectors. |
| 11.4 | Any new Kaito or Tavily endpoints used that aren't in the tool inventory | Grep agent configs for MCP tool function names. Cross-reference against V3_ARCHITECTURE.md Section 3 tool lists. Flag any tool call not in the inventory. |

### 11c. New Files & Folders

| # | Check | How to verify |
|---|-------|--------------|
| 11.5 | Any .md file in `config/`, `templates/`, `commands/`, or `seeds/` not listed in the Document Registry (Section 2 of this protocol) | `ls` each folder, compare against the manifest table. Any file not in the manifest = orphaned or newly added and needs to be registered. |
| 11.6 | Any new data file in `account_data/` not defined in `data_schema_map.md` Section 4 | `ls account_data/data/` and `account_data/output/`. Cross-reference each file against the schema map. Flag any file without a schema definition. |
| 11.7 | Any new folder not in V3_ARCHITECTURE.md Section 6 (Folder Structure) | `ls -d */` recursively from the v3 root. Compare against the architecture doc's folder tree. Flag any directory not documented. |

### 11d. New Schema Fields

| # | Check | How to verify |
|---|-------|--------------|
| 11.8 | Any field written by an agent that isn't in the canonical schema | For each agent config, extract every field name referenced in output/write instructions. Cross-reference against `data_schema_map.md` Section 3 (canonical) and Section 4 (file-specific schemas). Flag any field that exists in agent instructions but not in the schema map. |
| 11.9 | Any new section added to `account_profile_template.md` or `account_profile.md` not reflected in agent configs | Compare template section headers against agent_onboarding.md (which populates them) and agent_analytics.md / agent_daily_pull.md (which read them). Flag sections that no agent references. |

### 11e. New Agent Behaviours & Rules

| # | Check | How to verify |
|---|-------|--------------|
| 11.10 | Any new operational rule not propagated to all relevant docs | Scan each agent config for rules, limits, or constraints (rate limits, frequency caps, thresholds, fallback logic). Classify each rule's scope: **global** (affects all agents → must be in CLAUDE.md), **multi-agent** (affects 2+ agents → must be in CLAUDE.md AND each affected agent's config), **single-agent** (affects one agent only → lives in that agent's config, but must be referenced in V3_ARCHITECTURE.md if it impacts the pipeline). Flag any rule that exists in one place but is missing from the others its scope requires. |
| 11.11 | Any new skill or command referenced in agent configs not listed in V3_ARCHITECTURE.md Section 4–5 | Grep agent configs for skill names and command references. Cross-reference against the Plugin/Skill Inventory and Skill-to-Agent Mapping. |
| 11.12 | No stale `config/agent_*.md` references in runtime docs (v3.1) | Grep for `config/agent_daily_pull`, `config/agent_analytics`, `config/agent_weekly_learning` across all non-archive files. Allowed only in: (a) archive headers in `config/` files, (b) this document's registry, (c) historical logs in `account_data/logs/` and `Claude Code output/`. Flag any runtime doc (CLAUDE.md, agents/, orchestrators/, templates/) that still references config/ paths for Agents ②③④. |

### 11f. Additions Report Template

> At the end of every alignment check run, produce this report if any items were flagged in Section 11.

```
### New Additions Report — {date}

#### New Terminology (11.1–11.2)
| Term | Found In | Proposed Definition | Action |
|------|----------|-------------------|--------|
| | | | Add to Vocabulary / Local-only / Rename |

#### New Data Sources (11.3–11.4)
| Source/Tool | Found In | Action |
|-------------|----------|--------|
| | | Add to inventory / Document / Remove reference |

#### New Files & Folders (11.5–11.7)
| Path | Type | Action |
|------|------|--------|
| | file/folder | Add to registry / Add schema / Delete orphan |

#### New Schema Fields (11.8–11.9)
| Field | Found In | Missing From | Action |
|-------|----------|-------------|--------|
| | | | Add to schema / Remove from agent / Rename |

#### New Rules & Behaviours (11.10–11.11)
| Rule/Behaviour | Found In | Scope | Should Also Be In | Action |
|----------------|----------|-------|-------------------|--------|
| | | global/multi/single | | Promote to CLAUDE.md + agent configs / Add to specific agent configs / Add to V3_ARCHITECTURE / Local-only |
```

---

## Execution Log Template

```
## Alignment Check — {date}

**Triggered by**: {what change prompted this check}
**Run by**: {operator / agent}

| Category | Pass | Fail | Notes |
|----------|------|------|-------|
| 1. Vocabulary Consistency | /4 | /4 | |
| 2. Document Registry | /5 | /5 | |
| 3. Cross-Document References | /4 | /4 | |
| 4. MCP & Connector Alignment | /6 | /6 | |
| 5. Data Schema Alignment | /7 | /7 | |
| 6. Agent Config Consistency | /5 | /5 | |
| 7. Profile Template ↔ Instructions | /4 | /4 | |
| 8. Terminology Regression | /5 | /5 | |
| 9. Folder Structure Integrity | /4 | /4 | |
| 10. Handoff & Pipeline Continuity | /6 | /6 | |
| 11. New Additions Discovery | /12 | /12 | |
| **TOTAL** | /62 | /62 | |

### Failures & Resolutions
| Check # | Description | Resolution | Verified |
|---------|-------------|------------|----------|
| | | | |

### New Additions Report
{Attach the Section 11f report here if any items were flagged}
```
