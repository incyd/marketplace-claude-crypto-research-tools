---
name: setup-skills-master-mcp
description: Install and configure the skills-master MCP server for Claude Code. Use when setting up skills-master-mcp, adding the SkillsMCP server to a project, or when the MCP server fails to start because node is not found in PATH.
allowed-tools: Bash, Read, Write, Edit
---

# Setup skills-master MCP

Guide the user through installing and configuring the `skills-master-mcp` server for Claude Code.

## Step 1: Check Node.js availability

First, detect whether `node` is available and where it lives:

```bash
which node || echo "node not in PATH"
node --version 2>/dev/null || echo "node not runnable"
```

If node is not found in PATH, check common nvm locations:

```bash
ls ~/.nvm/versions/node/ 2>/dev/null | tail -1
```

If nvm is present, identify the active version:

```bash
ls -t ~/.nvm/versions/node/ | head -1
```

Store the node bin path (e.g. `~/.nvm/versions/node/v25.6.1/bin`) — you'll need it in Step 3.

## Step 2: Check if skills-master-mcp is already installed

```bash
PATH="$(ls -td ~/.nvm/versions/node/*/bin 2>/dev/null | head -1):$PATH" npx skills-master-mcp --version 2>/dev/null || echo "not installed"
```

## Step 3: Add to .mcp.json

Determine the correct config target:
- **Project-level** (recommended): `.mcp.json` in the project root
- **User-level**: `~/.claude.json` under `mcpServers`

Write (or merge) the following into `.mcp.json` in the project root.

**Critical**: The `env.PATH` field must include the node bin directory so that `npx` can find `node` at runtime — Claude Code does not inherit your shell's nvm PATH.

```json
{
  "mcpServers": {
    "skills-master": {
      "command": "/REPLACE_WITH_NODE_BIN_PATH/npx",
      "args": ["skills-master-mcp"],
      "env": {
        "PATH": "/REPLACE_WITH_NODE_BIN_PATH:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

Replace `/REPLACE_WITH_NODE_BIN_PATH` with the actual path found in Step 1 (e.g. `/Users/yourname/.nvm/versions/node/v25.6.1/bin`).

If `.mcp.json` already exists with other servers, merge the `skills-master` entry into the existing `mcpServers` object rather than overwriting the file.

## Step 4: Verify the config

```bash
cat .mcp.json
```

Confirm:
- `command` points to the full path of `npx`
- `env.PATH` starts with the node bin directory
- JSON is valid (no trailing commas)

## Step 5: Restart Claude Code

Tell the user:

> The MCP server config is ready. Please restart Claude Code (or run `/mcp` to reload servers) to connect `skills-master-mcp`.

After restart, the `mcp__skills-master__*` tools (`search`, `ai_search`, `read_skill`, `install_skill`, etc.) will be available.

## Troubleshooting

**"env: node: No such file or directory" / exit code 127**
- Root cause: `npx` is invoked via full path but `node` is not in the MCP process's `PATH`
- Fix: Ensure `env.PATH` in `.mcp.json` includes the node bin directory (see Step 3)

**"npx: command not found"**
- The `command` path is wrong. Re-run Step 1 to find the correct node bin directory.

**MCP server appears but tools return errors**
- Run `npx skills-master-mcp --help` (with the correct PATH) to confirm the package is reachable
- Try reinstalling: `npm install -g skills-master-mcp`

**Multiple Node versions via nvm**
- Use `nvm current` (with nvm sourced) to find the active version, or pick the latest from `~/.nvm/versions/node/`
- The version used in `.mcp.json` does not need to match your shell's active version — any working node will do
