import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request.headers.get("authorization"));
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const contentItemId = String(body.content_item_id || "");
  const connectionId = String(body.social_connection_id || "");
  const runAt = String(body.run_at || "");
  if (!contentItemId || !connectionId || !runAt) return NextResponse.json({ error: "content_item_id, social_connection_id and run_at are required." }, { status: 400 });
  const result = await auth.admin.from("publish_jobs").upsert({
    content_item_id: contentItemId,
    social_connection_id: connectionId,
    run_at: new Date(runAt).toISOString(),
    status: "scheduled",
    created_by: auth.authUser.id
  }, { onConflict: "content_item_id,social_connection_id" }).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, job: result.data });
}
