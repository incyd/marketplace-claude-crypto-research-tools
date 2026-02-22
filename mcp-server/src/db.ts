/**
 * Neon Postgres logging for MCP interactions.
 * Logs every request/response with timestamp.
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

export async function initDb(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS mcp_interactions (
      id        SERIAL PRIMARY KEY,
      tool_name TEXT NOT NULL,
      request   JSONB NOT NULL,
      response  JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  console.log("Database schema ready.");
}

export async function logInteraction(data: {
  toolName: string;
  request: unknown;
  response: unknown;
}): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO mcp_interactions (tool_name, request, response)
     VALUES ($1, $2, $3)`,
    [
      data.toolName,
      JSON.stringify(data.request),
      JSON.stringify(data.response),
    ]
  );
}
