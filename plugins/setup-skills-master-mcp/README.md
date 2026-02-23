# 🔧 Setup Skills Master MCP — Claude Code Skill

A Claude Code skill that guides you through installing and configuring the [`skills-master-mcp`](https://github.com/davila7/skills-master-mcp) server — so you can search, install, and manage Claude Code skills from within Claude.

---

## 📦 Install

```bash
/plugin install setup-skills-master-mcp@claude-crypto-research-tools
```

Or add the full marketplace and install from there:

```bash
/plugin marketplace add incyd/marketplace-claude-crypto-research-tools
```

---

## 🛠️ What It Does

Walks you through setting up `skills-master-mcp` end-to-end:

| Step | What Happens |
|------|-------------|
| 1 | Detects your Node.js path (including nvm installs) |
| 2 | Checks if `skills-master-mcp` is already available |
| 3 | Writes the correct entry into `.mcp.json` with a hardened `env.PATH` |
| 4 | Verifies the config is valid JSON |
| 5 | Prompts you to restart Claude Code to activate the server |

The critical part: Claude Code doesn't inherit your shell's `nvm` PATH at runtime. This skill handles that automatically — finding your node bin path and writing it into the MCP config's `env.PATH`.

---

## ⚡ Usage

After installing, just ask Claude:

```
set up skills-master-mcp for this project
```

```
skills-master-mcp isn't working — can you fix the MCP config?
```

---

## ✅ After Setup

Once the MCP server is running, you'll have access to:

- `/plugin search <query>` — find skills on the marketplace
- `/plugin install <skill>` — install any skill from GitHub
- `read_skill`, `ai_search`, `install_skill` tools available to Claude in-session
