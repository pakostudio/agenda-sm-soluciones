import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { publishToConnection } from "@/lib/social-publish";

const runDuePublish = async (request: NextRequest) => {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const jobs = await admin
    .from("publish_jobs")
    .select("*, content_items(*), social_connections(*)")
    .eq("status", "scheduled")
    .lte("run_at", new Date().toISOString())
    .limit(10);
  if (jobs.error) return NextResponse.json({ error: jobs.error.message }, { status: 400 });

  const results = [];
  for (const job of jobs.data || []) {
    try {
      await admin.from("publish_jobs").update({ status: "publishing", attempts: (job.attempts || 0) + 1 }).eq("id", job.id);
      let asset = null;
      if (job.content_items.asset_id) {
        const assetRes = await admin.from("media_assets").select("*").eq("id", job.content_items.asset_id).single();
        if (assetRes.error) throw new Error(assetRes.error.message);
        const signed = await admin.storage.from("content-media").createSignedUrl(assetRes.data.storage_path, 60 * 30);
        if (signed.error) throw new Error(signed.error.message);
        asset = { ...assetRes.data, public_url: signed.data.signedUrl };
      }
      const published = await publishToConnection(admin, job.content_items, job.social_connections, asset);
      await admin.from("publish_jobs").update({ status: "published", provider_post_id: published.provider_post_id, provider_response: published.response }).eq("id", job.id);
      await admin.from("content_items").update({ status: "published", published_at: new Date().toISOString() }).eq("id", job.content_item_id);
      results.push({ id: job.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed.";
      await admin.from("publish_jobs").update({ status: "failed", last_error: message }).eq("id", job.id);
      results.push({ id: job.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, results });
};

export async function GET(request: NextRequest) {
  return runDuePublish(request);
}

export async function POST(request: NextRequest) {
  return runDuePublish(request);
}
