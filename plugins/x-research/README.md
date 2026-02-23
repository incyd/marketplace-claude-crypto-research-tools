# 🔬 X Research — Claude Code Skill

A Claude Code skill for X/Twitter research workflows. Surface crypto narratives, dev discussions, and market signals directly from your coding environment.

Powered by the [X Research MCP Connector](../../connectors/x-research-mcp/).

---

## 📦 Install

**From the marketplace:**

```bash
/plugin install x-research@claude-crypto-research-tools
```

**Or install standalone:**

```bash
/plugin install incyd/marketplace-claude-crypto-research-tools
```

---

## 🛠️ What It Does

Adds an `x-research` skill to Claude Code that lets you invoke X/Twitter research as part of any workflow:

| Capability | Description |
|------------|-------------|
| Keyword search | Search recent tweets with X operators (`from:`, `#`, `-is:retweet`, etc.) |
| Engagement filtering | Filter by minimum likes, sort by impressions or retweets |
| Profile lookup | Pull recent tweets from any account |
| Thread fetch | Reconstruct a full conversation from a root tweet ID |
| Time filtering | Scope to last 1h, 3h, 12h, 1d, or 7d |

---

## ⚡ Usage

Trigger the skill by asking Claude Code naturally or with the `/x-research` command:

```
/x-research what are devs saying about @solana this week?
```

```
x research: search for $BTC narratives sorted by impressions, last 24h
```

```
search x for "Ethereum L2" -is:retweet min_likes:50
```

---

## 🔧 Requirements

This skill requires the **X Research MCP Connector** to be configured in Claude.ai.

→ [MCP Connector setup guide](../../connectors/x-research-mcp/)
