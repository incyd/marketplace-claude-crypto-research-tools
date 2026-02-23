/**
 * X Research MCP Server
 *
 * Multi-tenant MCP server for querying X/Twitter data from Claude.ai.
 * Deployed on Render — no auth required to connect.
 *
 * Uses Streamable HTTP transport (MCP spec 2025-03-26) — single /mcp endpoint.
 *
 * Connection flow:
 *   1. First-time  → POST /mcp  (no session_id)
 *                 → call setup_session({bearer_token})
 *                 → receive permanent mcp_url → update Claude.ai settings
 *
 *   2. Returning   → POST /mcp?session_id=UUID
 *                 → token auto-loaded from DB — never re-enter token
 *
 * Tool interactions logged to Neon Postgres (user_identifier, tool, request, response).
 */

import { randomUUID } from "crypto";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import * as api from "./api.js";
import {
  initDb,
  logInteraction,
  createSession,
  getSessionToken,
  touchSession,
} from "./db.js";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

// Active MCP sessions: Mcp-Session-Id header value → {server, transport}
const sessions = new Map<
  string,
  { server: Server; transport: StreamableHTTPServerTransport }
>();

// ── Tool definitions ──────────────────────────────────────────────────────────

const SETUP_TOOL: Tool = {
  name: "setup_session",
  description:
    "Register your X API bearer token with this MCP server. " +
    "Call this once — you will receive a permanent session URL. " +
    "Save that URL as your MCP server address in Claude.ai so you never need to enter your token again.",
  inputSchema: {
    type: "object",
    properties: {
      bearer_token: {
        type: "string",
        description:
          "Your X API bearer token (starts with 'AAAA...'). " +
          "Find it at https://developer.twitter.com/en/portal/dashboard",
      },
    },
    required: ["bearer_token"],
  },
};

const X_TOOLS: Tool[] = [
  {
    name: "search_x",
    description:
      "Search recent tweets on X/Twitter (last 7 days). " +
      'Supports X search operators like from:user, #hashtag, "exact phrase", -is:retweet, etc.',
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query. Supports X operators (from:, #, -is:retweet, etc.)",
        },
        sort: {
          type: "string",
          enum: ["likes", "impressions", "retweets", "recent"],
          description: "Sort order (default: likes)",
        },
        pages: {
          type: "number",
          description: "Pages to fetch, 1–5 (default: 1, ~100 tweets/page)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 15)",
        },
        since: {
          type: "string",
          description: "Time filter: 1h, 3h, 12h, 1d, 7d (default: last 7 days)",
        },
        min_likes: {
          type: "number",
          description: "Filter: minimum likes threshold",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_profile",
    description: "Get recent tweets from a specific X/Twitter user.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "X username without the @ symbol",
        },
        count: {
          type: "number",
          description: "Number of tweets to fetch (default: 20, max: 100)",
        },
      },
      required: ["username"],
    },
  },
  {
    name: "get_thread",
    description: "Fetch a full conversation thread by root tweet ID.",
    inputSchema: {
      type: "object",
      properties: {
        tweet_id: {
          type: "string",
          description: "The root tweet ID of the conversation",
        },
      },
      required: ["tweet_id"],
    },
  },
  {
    name: "get_tweet",
    description: "Fetch a single tweet by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        tweet_id: {
          type: "string",
          description: "Tweet ID",
        },
      },
      required: ["tweet_id"],
    },
  },
];

// ── MCP Server factory (one per connection) ────────────────────────────────────

function createMcpServer(bearerToken: string | null, dbSessionId: string | null): Server {
  const server = new Server(
    { name: "x-research-mcp", version: "1.2.0" },
    { capabilities: { tools: {} } }
  );

  // No token → only setup_session; token present → all tools
  const tools: Tool[] = bearerToken ? [SETUP_TOOL, ...X_TOOLS] : [SETUP_TOOL];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    let result: unknown;
    let isError = false;

    try {
      // ── setup_session ─────────────────────────────────────────────────────
      if (name === "setup_session") {
        const token = args["bearer_token"] as string;
        if (!token || !token.trim()) throw new Error("bearer_token is required");

        const newSessionId = await createSession(token.trim());
        const sessionUrl = PUBLIC_URL
          ? `${PUBLIC_URL}/mcp?session_id=${newSessionId}`
          : `/mcp?session_id=${newSessionId}`;

        result = {
          success: true,
          session_id: newSessionId,
          mcp_url: sessionUrl,
          message:
            "Your session is ready! Copy the mcp_url and use it as your MCP server " +
            "address in Claude.ai (Settings → Integrations → MCP Servers). " +
            "You will never need to enter your bearer token again.",
          instructions: [
            "1. Copy the mcp_url shown above",
            "2. In Claude.ai → Settings → Integrations → MCP Servers → Edit this server",
            "3. Replace the current URL with the mcp_url",
            "4. Save and reconnect — your token is now permanent",
          ],
        };

      // ── X tools ───────────────────────────────────────────────────────────
      } else if (!bearerToken) {
        throw new Error(
          "No bearer token for this session. " +
            "Please call setup_session({bearer_token: 'YOUR_TOKEN'}) first."
        );
      } else {
        switch (name) {
          case "search_x": {
            let tweets = await api.search(bearerToken, args["query"] as string, {
              pages: args["pages"] as number | undefined,
              sortOrder: args["sort"] === "recent" ? "recency" : "relevancy",
              since: args["since"] as string | undefined,
            });
            if (args["min_likes"]) {
              tweets = api.filterEngagement(tweets, { minLikes: args["min_likes"] as number });
            }
            if (args["sort"] && args["sort"] !== "recent") {
              tweets = api.sortBy(tweets, args["sort"] as "likes" | "impressions" | "retweets");
            }
            tweets = api.dedupe(tweets).slice(0, (args["limit"] as number) || 15);
            result = { tweets, count: tweets.length };
            break;
          }
          case "get_profile": {
            const { user, tweets } = await api.profile(
              bearerToken,
              args["username"] as string,
              { count: args["count"] as number | undefined }
            );
            result = { user, tweets };
            break;
          }
          case "get_thread": {
            const tweets = await api.thread(bearerToken, args["tweet_id"] as string);
            result = { tweets, count: tweets.length };
            break;
          }
          case "get_tweet": {
            const tweet = await api.getTweet(bearerToken, args["tweet_id"] as string);
            result = { tweet };
            break;
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      }
    } catch (err: unknown) {
      result = { error: err instanceof Error ? err.message : String(err) };
      isError = true;
    }

    // Non-blocking DB log
    logInteraction({
      toolName: name,
      request: { tool: name, arguments: args },
      response: result,
      userIdentifier: dbSessionId,
    }).catch((dbErr) => console.error("DB log failed:", dbErr));

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError,
    };
  });

  return server;
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

/**
 * Primary MCP endpoint — Streamable HTTP transport (MCP spec 2025-03-26).
 * Handles POST (initialize + requests), GET (SSE stream), DELETE (session end).
 *
 * Query param:
 *   session_id  — our DB UUID; used to look up the bearer token on new connections.
 *                 Persists across server restarts (stored in Neon Postgres).
 */
app.all("/mcp", async (req, res) => {
  const ourSessionId = req.query["session_id"] as string | undefined;
  const mcpSessionId = req.headers["mcp-session-id"] as string | undefined;

  // ── Route to existing session ─────────────────────────────────────────────
  if (mcpSessionId && sessions.has(mcpSessionId)) {
    const { transport } = sessions.get(mcpSessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // ── New connection — resolve bearer token from DB ────────────────────────
  let bearerToken: string | null = null;
  const dbSessionId: string | null = ourSessionId ?? null;

  if (ourSessionId) {
    bearerToken = await getSessionToken(ourSessionId).catch(() => null);
    if (!bearerToken) {
      res.status(401).json({
        error: "Session not found or expired.",
        help: "Connect to /mcp (no session_id) and call setup_session to create a new session.",
      });
      return;
    }
    touchSession(ourSessionId).catch(() => {});
    console.log(`DB session ${ourSessionId} reconnected.`);
  } else {
    console.log("New connection without token — setup_session only.");
  }

  // ── Create server + transport ─────────────────────────────────────────────
  const server = createMcpServer(bearerToken, dbSessionId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
      console.log(`MCP session ${sessionId} started. Active: ${sessions.size}`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.log(`MCP session ${transport.sessionId} closed. Active: ${sessions.size}`);
    }
    server.close().catch(() => {});
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

/** Health check */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    activeSessions: sessions.size,
    server: "x-research-mcp",
    version: "1.2.0",
  });
});

/** Quickstart guide */
app.get("/", (_req, res) => {
  res.json({
    name: "X Research MCP Server",
    version: "1.2.0",
    description: "Query X/Twitter data from Claude.ai using your X API bearer token.",
    quickstart: [
      "1. In Claude.ai → Settings → Integrations → MCP Servers",
      `2. Add server URL: ${PUBLIC_URL || "https://YOUR_RENDER_URL"}/mcp`,
      "3. Call the setup_session tool with your X API bearer token",
      "4. Copy the returned mcp_url and update your Claude.ai MCP server address",
      "5. Done — your token is saved. You'll never need to enter it again.",
    ],
    tools: ["setup_session", "search_x", "get_profile", "get_thread", "get_tweet"],
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await initDb();
  } catch (err) {
    console.warn("DB init failed (interactions won't be logged):", err);
  }

  app.listen(PORT, () => {
    console.log(`X Research MCP Server v1.2.0 listening on port ${PORT}`);
    if (PUBLIC_URL) {
      console.log(`Public URL: ${PUBLIC_URL}`);
      console.log(`MCP endpoint: ${PUBLIC_URL}/mcp`);
    }
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
