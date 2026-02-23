/**
 * Neon Postgres — sessions and interaction logging for the X Research MCP server.
 *
 * Tables:
 *   mcp_sessions      – stores bearer tokens keyed by a UUID session_id
 *   mcp_interactions  – logs every tool call with user_identifier, request, response, timestamp
 */

import { Pool } from "@neondatabase/serverless";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

// ── Schema init ────────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const db = getPool();

  // Sessions: maps a stable UUID → bearer token so users never re-enter their token
  await db.query(`
    CREATE TABLE IF NOT EXISTS mcp_sessions (
      session_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      bearer_token TEXT        NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Interaction log: every tool call is recorded with the user's session_id
  await db.query(`
    CREATE TABLE IF NOT EXISTS mcp_interactions (
      id              SERIAL      PRIMARY KEY,
      user_identifier TEXT,
      tool_name       TEXT        NOT NULL,
      request         JSONB       NOT NULL,
      response        JSONB       NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("Database schema ready.");
}

// ── Session CRUD ───────────────────────────────────────────────────────────────

/** Create a new session for a bearer token. Returns the new UUID session_id. */
export async function createSession(bearerToken: string): Promise<string> {
  const db = getPool();
  const result = await db.query<{ session_id: string }>(
    `INSERT INTO mcp_sessions (bearer_token) VALUES ($1) RETURNING session_id::text`,
    [bearerToken]
  );
  return result.rows[0].session_id;
}

/** Retrieve the bearer token stored for a session. Returns null if not found. */
export async function getSessionToken(sessionId: string): Promise<string | null> {
  const db = getPool();
  const result = await db.query<{ bearer_token: string }>(
    `SELECT bearer_token FROM mcp_sessions WHERE session_id = $1`,
    [sessionId]
  );
  return result.rows[0]?.bearer_token ?? null;
}

/** Update last_used_at for a session (keep-alive). */
export async function touchSession(sessionId: string): Promise<void> {
  const db = getPool();
  await db.query(
    `UPDATE mcp_sessions SET last_used_at = NOW() WHERE session_id = $1`,
    [sessionId]
  );
}

// ── Interaction logging ────────────────────────────────────────────────────────

export async function logInteraction(data: {
  toolName: string;
  request: unknown;
  response: unknown;
  userIdentifier?: string | null;
}): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO mcp_interactions (user_identifier, tool_name, request, response)
     VALUES ($1, $2, $3, $4)`,
    [
      data.userIdentifier ?? null,
      data.toolName,
      JSON.stringify(data.request),
      JSON.stringify(data.response),
    ]
  );
}
