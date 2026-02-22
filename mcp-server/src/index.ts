/**
 * X Research MCP Server
 *
 * Multi-tenant MCP server for querying X/Twitter data.
 * Each user passes their own X API bearer token via the SSE URL:
 *   GET /sse?x_bearer_token=YOUR_TOKEN
 *
 * All interactions are logged to Neon Postgres (request, response, datetime).
 * Deploy on Apify — server listens on ACTOR_WEB_SERVER_PORT.
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
import { initDb, logInteraction } from "./db.js";

const app = express();
app.use(express.json());

const PORT = parseInt(
  process.env.ACTOR_WEB_SERVER_PORT || process.env.PORT || "3000"
);

// Active SSE transports keyed by sessionId
const transports = new Map<string, SSEServerTransport>();

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "search_x",
    description:
      "Search recent tweets on X/Twitter (last 7 days). Supports X search operators like from:user, #hashtag, \"exact phrase\", etc.",
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
          description: "Time filter shorthand: 1h, 3h, 12h, 1d, 7d (default: last 7 days)",
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

// ── MCP Server factory (one per SSE connection) ───────────────────────────────

function createMcpServer(bearerToken: string): Server {
  const server = new Server(
    { name: "x-research-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    let result: unknown;
    let isError = false;

    try {
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
    } catch (err: unknown) {
      result = { error: err instanceof Error ? err.message : String(err) };
      isError = true;
    }

    // Log to Neon (non-blocking — don't fail the request if DB is down)
    logInteraction({
      toolName: name,
      request: { tool: name, arguments: args },
      response: result,
    }).catch((dbErr) => console.error("DB log failed:", dbErr));

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError,
    };
  });

  return server;
}

// ── HTTP routes ───────────────────────────────────────────────────────────────

// Establish SSE connection — bearer token passed as query param
app.get("/sse", async (req, res) => {
  const bearerToken = req.query["x_bearer_token"] as string;

  if (!bearerToken) {
    res.status(401).json({
      error: "Missing x_bearer_token query parameter.",
      usage: "Connect to: /sse?x_bearer_token=YOUR_X_BEARER_TOKEN",
    });
    return;
  }

  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer(bearerToken);

  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    transports.delete(transport.sessionId);
    server.close().catch(() => {});
    console.log(`Session ${transport.sessionId} disconnected. Active: ${transports.size}`);
  });

  console.log(`New session ${transport.sessionId}. Active: ${transports.size}`);
  await server.connect(transport);
});

// Receive messages from client
app.post("/messages", async (req, res) => {
  const sessionId = req.query["sessionId"] as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: `Session ${sessionId} not found or expired.` });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    activeSessions: transports.size,
    server: "x-research-mcp",
    version: "1.0.0",
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main() {
  // Init DB schema
  try {
    await initDb();
  } catch (err) {
    console.warn("DB init failed (interactions won't be logged):", err);
  }

  app.listen(PORT, () => {
    console.log(`X Research MCP Server listening on port ${PORT}`);
    console.log(`Connect Claude.ai to: https://YOUR_APIFY_URL/sse?x_bearer_token=TOKEN`);
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
