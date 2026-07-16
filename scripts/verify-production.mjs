const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://agenda-sm-soluciones-github.vercel.app";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

const base = appUrl.replace(/\/$/, "");

const publicConfig = await fetch(`${base}/api/public-config`).then((res) => res.json());
if (!publicConfig.supabase?.configured) {
  throw new Error("Supabase is not configured in production.");
}

const setupStatus = await fetch(`${base}/api/setup-status`).then((res) => res.json());
if (!setupStatus.ok) {
  console.error(JSON.stringify(setupStatus.checks, null, 2));
  throw new Error("Production setup checks failed. Configure missing Vercel variables and apply Supabase SQL before retrying.");
}
if (!setupStatus.oauthOk) {
  console.warn("Core app is ready. OAuth credentials for social networks are still pending.");
}

if (!email || !password) {
  console.log("Supabase setup is ready. Set ADMIN_EMAIL and ADMIN_PASSWORD to verify login.");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(publicConfig.supabase.url, publicConfig.supabase.anonKey);
const login = await supabase.auth.signInWithPassword({ email, password });
if (login.error || !login.data.user) throw new Error(login.error?.message || "Login failed.");

const [profile, brands, prompts] = await Promise.all([
  supabase.from("profiles").select("id, role, active").eq("id", login.data.user.id).single(),
  supabase.from("brands").select("id, name, networks").order("name"),
  supabase.from("master_prompts").select("id, title, network")
]);

if (profile.error || !profile.data?.active) throw new Error(profile.error?.message || "Profile is not active.");
if (brands.error || (brands.data || []).length < 3) throw new Error(brands.error?.message || "Expected seeded brands.");
if (prompts.error || (prompts.data || []).length < 5) throw new Error(prompts.error?.message || "Expected seeded prompts.");

const storage = await supabase.storage.from("content-media").list("", { limit: 1 });
if (storage.error) throw new Error(storage.error.message);

console.log("Production verification passed.");
