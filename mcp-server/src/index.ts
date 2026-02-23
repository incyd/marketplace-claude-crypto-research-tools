/**
 * X Research MCP Server
 *
 * Multi-tenant MCP server for querying X/Twitter data from Claude.ai.
 * Deployed on Render — no auth required to connect.
 *
 * Connection options:
 *   1. First-time setup  → GET /sse  (no params)
 *                          → call setup_session({bearer_token}) tool
 *                          → receive a permanent session URL to save in Claude.ai
 *
 *   2. Returning user    → GET /sse?session_id=UUID
 *                          → token loaded from Neon DB automatically — no re-entry needed
 *
 *   3. Direct (advanced) → GET /sse?x_bearer_token=TOKEN
 *                          → auto-creates a session, returns session URL
 *
 * All tool interactions are logged to Neon Postgres (user_identifier, request, response, datetime).
 */

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

// Base public URL — set via PUBLIC_URL env var (configured in Apify)
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

// Active SSE transports keyed by sessionId
const transports = new Map<string, SSEServerTransport>();

// ── Tool definitions ──────────────────────────────────────────────────────────

/** The setup tool is always available — used on first connect or to retrieve session URL */
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
          "Your X API bearer token (starts with 'AAAA...'). Find it at https://developer.twitter.com/en/portal/dashboard",
      },
    },
    required: ["bearer_token"],
  },
};

const X_TOOLS: Tool[] = [
  {
    name: "search_x",
    description:
      "Search recent tweets on X/Twitter (last 7 days). Supports X search operators like from:user, #hashtag, \"exact phrase\", -is:retweet, etc.",
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

// ── MCP Server factory (one instance per SSE connection) ─────────────────────

function createMcpServer(
  bearerToken: string | null,
  sessionId: string | null
): Server {
  const server = new Server(
    { name: "x-research-mcp", version: "1.1.0" },
    { capabilities: { tools: {} } }
  );

  // If no token yet, only expose setup_session
  const tools: Tool[] = bearerToken ? [SETUP_TOOL, ...X_TOOLS] : [SETUP_TOOL];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    let result: unknown;
    let isError = false;
    let currentSessionId = sessionId;

    try {
      // ── setup_session ──────────────────────────────────────────────────────
      if (name === "setup_session") {
        const token = args["bearer_token"] as string;
        if (!token || !token.trim()) {
          throw new Error("bearer_token is required");
        }

        const newSessionId = await createSession(token.trim());
        const sessionUrl = PUBLIC_URL
          ? `${PUBLIC_URL}/sse?session_id=${newSessionId}`
          : `/sse?session_id=${newSessionId}`;

        result = {
          success: true,
          session_id: newSessionId,
          mcp_url: sessionUrl,
          message:
            "Your session is ready! Copy the mcp_url and use it as your MCP server address in Claude.ai " +
            "(Settings → Integrations → MCP Servers). You will never need to enter your bearer token again.",
          instructions: [
            "1. Copy the mcp_url shown above",
            "2. In Claude.ai → Settings → Integrations → MCP Servers → Add server",
            "3. Paste the mcp_url as the server URL",
            "4. Disconnect from this session and reconnect using the new URL",
          ],
        };

      // ── X tools (require bearer token) ────────────────────────────────────
      } else if (!bearerToken) {
        throw new Error(
          "No bearer token for this session. Please call setup_session({bearer_token: 'YOUR_TOKEN'}) first."
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
              tweets = api.filterEngagement(tweets, {
                minLikes: args["min_likes"] as number,
              });
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

    // Log interaction non-blocking — don't fail the request if DB is down
    logInteraction({
      toolName: name,
      request: { tool: name, arguments: args },
      response: result,
      userIdentifier: currentSessionId,
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
 * Establish SSE connection.
 *
 * Query params (all optional):
 *   session_id      — returning user with saved session
 *   x_bearer_token  — advanced/direct usage (also creates a session)
 *
 * No params → first-time user; only setup_session tool is available.
 */
app.get("/sse", async (req, res) => {
  const bearerTokenParam = req.query["x_bearer_token"] as string | undefined;
  const sessionIdParam = req.query["session_id"] as string | undefined;

  let bearerToken: string | null = null;
  let sessionId: string | null = null;

  if (sessionIdParam) {
    // Returning user — look up token from DB
    bearerToken = await getSessionToken(sessionIdParam).catch(() => null);
    if (!bearerToken) {
      res.status(401).json({
        error: "Session not found or expired.",
        help: "Connect without parameters and call setup_session to create a new session.",
      });
      return;
    }
    sessionId = sessionIdParam;
    // Update last_used_at in background
    touchSession(sessionIdParam).catch(() => {});
    console.log(`Session ${sessionIdParam} reconnected.`);

  } else if (bearerTokenParam) {
    // Direct/advanced usage with raw token — auto-create a session
    bearerToken = bearerTokenParam;
    sessionId = await createSession(bearerToken).catch(() => null);
    console.log(`Direct token connection — created session ${sessionId}.`);

  } else {
    // First-time user — no token yet, only setup_session will be exposed
    console.log("New connection without token — setup_session tool available.");
  }

  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer(bearerToken, sessionId);

  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    transports.delete(transport.sessionId);
    server.close().catch(() => {});
    console.log(`Transport ${transport.sessionId} closed. Active: ${transports.size}`);
  });

  console.log(`SSE session ${transport.sessionId} started. Active: ${transports.size}`);
  await server.connect(transport);
});

/** Receive messages from client */
app.post("/messages", async (req, res) => {
  const sessionId = req.query["sessionId"] as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: `Session ${sessionId} not found or expired.` });
    return;
  }

  await transport.handlePostMessage(req, res);
});

/** Health check */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    activeSessions: transports.size,
    server: "x-research-mcp",
    version: "1.1.0",
  });
});

/** Setup guide for first-time visitors */
app.get("/", (_req, res) => {
  res.json({
    name: "X Research MCP Server",
    version: "1.1.0",
    description: "Query X/Twitter data from Claude.ai using your X API bearer token.",
    quickstart: [
      "1. In Claude.ai → Settings → Integrations → MCP Servers",
      `2. Add server URL: ${PUBLIC_URL || "https://YOUR_APIFY_URL"}/sse`,
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
    console.log(`X Research MCP Server v1.1.0 listening on port ${PORT}`);
    if (PUBLIC_URL) {
      console.log(`Public URL: ${PUBLIC_URL}`);
      console.log(`Connect Claude.ai to: ${PUBLIC_URL}/sse`);
      console.log(`First-time setup URL: ${PUBLIC_URL}/sse (no params — call setup_session)`);
    }
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
