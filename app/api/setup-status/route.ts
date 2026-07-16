import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const requiredTables = [
  "profiles",
  "brands",
  "master_prompts",
  "media_assets",
  "content_items",
  "content_history",
  "social_connections"
];

export async function GET() {
  const env = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    bootstrapSecret: Boolean(process.env.BOOTSTRAP_ADMIN_SECRET),
    oauthEncryptionKey: Boolean(process.env.OAUTH_ENCRYPTION_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET)
  };
  const oauth = {
    meta: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
    linkedin: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
    tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
  };

  const checks: Record<string, { ok: boolean; detail?: string | number }> = {
    env: {
      ok: env.supabaseUrl && env.anonKey && env.serviceRole && env.bootstrapSecret && env.oauthEncryptionKey && env.cronSecret,
      detail: Object.entries(env).filter(([, value]) => !value).map(([key]) => key).join(", ") || "ready"
    },
    oauth: {
      ok: oauth.meta && oauth.linkedin && oauth.tiktok,
      detail: Object.entries(oauth).filter(([, value]) => !value).map(([key]) => key).join(", ") || "ready"
    }
  };

  if (!checks.env.ok) {
    return NextResponse.json({ ok: false, checks });
  }

  try {
    const admin = getSupabaseAdmin();

    for (const table of requiredTables) {
      const result = await admin.from(table).select("*", { count: "exact", head: true });
      checks[`table:${table}`] = {
        ok: !result.error,
        detail: result.error?.message || result.count || 0
      };
    }

    const brands = await admin.from("brands").select("slug");
    const brandSlugs = new Set((brands.data || []).map((item) => item.slug));
    checks.seededBrands = {
      ok: ["gpc", "sm-soluciones", "lem"].every((slug) => brandSlugs.has(slug)),
      detail: brands.error?.message || Array.from(brandSlugs).join(", ")
    };

    const prompts = await admin.from("master_prompts").select("id", { count: "exact", head: true });
    checks.seededPrompts = {
      ok: !prompts.error && (prompts.count || 0) >= 5,
      detail: prompts.error?.message || prompts.count || 0
    };

    const bucket = await admin.storage.getBucket("content-media");
    checks.storageBucket = {
      ok: !bucket.error && bucket.data?.public === false,
      detail: bucket.error?.message || (bucket.data?.public ? "public" : "private")
    };

    const ok = Object.values(checks).every((check) => check.ok);
    return NextResponse.json({ ok, checks });
  } catch (error) {
    checks.adminClient = {
      ok: false,
      detail: error instanceof Error ? error.message : "Unexpected error."
    };
    return NextResponse.json({ ok: false, checks }, { status: 500 });
  }
}
