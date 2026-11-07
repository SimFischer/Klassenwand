import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL fehlt. Bitte .env.local anlegen.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("Datenbank-Migration abgeschlossen.");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Migration fehlgeschlagen. Bitte Datenbank-Verbindung und Migrationen prüfen.",
  );
  process.exitCode = 1;
});
