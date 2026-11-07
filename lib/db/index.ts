import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
let singleton: ReturnType<typeof drizzle> | undefined;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt.");
  return (singleton ??= drizzle(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    }),
  ));
}
