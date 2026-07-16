import { spawnSync } from "node:child_process";

const vars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "BOOTSTRAP_ADMIN_SECRET"
];

for (const key of vars) {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
  const result = spawnSync("vercel", ["env", "add", key, "production"], {
    input: `${value}\n`,
    stdio: ["pipe", "inherit", "inherit"]
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("Production environment variables added. Redeploy after this step.");
