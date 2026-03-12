# Connectors

## How tool references work

Plugin files use connector categories as placeholders for whatever tool the user connects in their Cowork environment. The plugin is tool-agnostic at the provider level. The `/setup` command auto-detects which connectors are available.

## Required Connectors

| Category | Placeholder | Options | Required? |
|----------|-------------|---------|-----------|
| X Account Tools | ~~x-account-tools | Any MCP connector providing `get_user_info`, `get_user_tweets`, `search_tweets`, `get_tweet_thread`, `get_tweet_replies` | Yes |
| Web Research | ~~web-research | Tavily (recommended), or any MCP connector providing `tavily_search`, `tavily_research` | Yes |
| Crypto Intelligence | ~~crypto-intelligence | Kaito AI (recommended), providing `kaito_advanced_search`, `kaito_mindshare`, `kaito_sentiment` | Recommended |
| X Search API | ~~x-search-api | Any MCP connector providing `search_x` (keyword-based tweet search) | Conditional (fallback if Kaito unavailable) |

## Setup Instructions

See `config/mcp_setup_guide.md` for detailed setup instructions including:
- How to get API keys for each service
- How to connect MCP servers in Cowork
- Rate limits and cost considerations
- Troubleshooting common issues

## Gate Logic

The `/setup` command enforces these requirements:
- X Account Tools + Web Research: **both required**
- At least one of Crypto Intelligence or X Search API: **required for keyword search**
- All four connected: **optimal configuration**
