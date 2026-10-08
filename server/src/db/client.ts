import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type PolarDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000 });
  return { db: drizzle({ client: pool, schema }), pool };
}
