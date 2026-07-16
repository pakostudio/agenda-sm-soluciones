import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL. Use the Supabase pooled or direct Postgres connection string.");
  process.exit(1);
}

const psqlCheck = spawnSync("psql", ["--version"], { encoding: "utf8" });
if (psqlCheck.status !== 0) {
  console.error("psql is required to apply SQL migrations. Install PostgreSQL client tools, then rerun this script.");
  process.exit(1);
}

const files = [
  "supabase/schema.sql",
  "supabase/seed.sql"
];

for (const file of files) {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) {
    console.error(`Missing ${file}`);
    process.exit(1);
  }
  console.log(`Applying ${file}...`);
  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1"], {
    input: readFileSync(path, "utf8"),
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"]
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("Supabase schema and seed applied.");
