# setup-skills-master-mcp

Claude Code skill that fixes the nvm PATH issue when setting up skills-master-mcp.

## One-liner install

Run this in your project directory:

```bash
curl -fsSL https://raw.githubusercontent.com/incyd/skills-master-mcp-setup-skill/main/install.sh | bash
```

This will:

1. Detect your Node.js location (including nvm installs)
2. Install the `setup-skills-master-mcp` skill into `.claude/skills/`
3. Write `.mcp.json` with the correct `env.PATH` so the MCP server can find node

Then restart Claude Code — the skills-master MCP server will connect automatically.

## Why this exists

When Claude Code launches an MCP server it does not inherit your shell's nvm PATH. So if Node.js was installed via nvm, `npx` can find node in your terminal but not inside the MCP process, causing:

```
env: node: No such file or directory (exit 127)
```

The installer detects where node actually lives and bakes that path into `.mcp.json` via the `env.PATH` field.

## What the skill does

Once installed, the `setup-skills-master-mcp` skill activates when you say things like:

> Set up skills-master-mcp

It walks you through:

- Verifying Node.js and npx are reachable
- Writing or merging `.mcp.json` with the PATH fix
- Troubleshooting common issues

## Manual install (no curl)

```bash
mkdir -p .claude/skills/setup-skills-master-mcp
curl -fsSL https://raw.githubusercontent.com/incyd/skills-master-mcp-setup-skill/main/.claude/skills/setup-skills-master-mcp/SKILL.md \
  -o .claude/skills/setup-skills-master-mcp/SKILL.md
```

