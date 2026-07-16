import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/supabase-admin";
import { publishToConnection } from "@/lib/social-publish";

const loadPublishContext = async (admin: any, contentItemId: string, connectionId: string) => {
  const [itemRes, connectionRes] = await Promise.all([
    admin.from("content_items").select("*").eq("id", contentItemId).single(),
    admin.from("social_connections").select("*").eq("id", connectionId).eq("status", "connected").single()
  ]);
  if (itemRes.error) throw new Error(itemRes.error.message);
  if (connectionRes.error) throw new Error(connectionRes.error.message);
  let asset = null;
  if (itemRes.data.asset_id) {
    const assetRes = await admin.from("media_assets").select("*").eq("id", itemRes.data.asset_id).single();
    if (assetRes.error) throw new Error(assetRes.error.message);
    const signed = await admin.storage.from("content-media").createSignedUrl(assetRes.data.storage_path, 60 * 30);
    if (signed.error) throw new Error(signed.error.message);
    asset = { ...assetRes.data, public_url: signed.data.signedUrl };
  }
  return { item: itemRes.data, connection: connectionRes.data, asset };
};

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request.headers.get("authorization"));
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const contentItemId = String(body.content_item_id || "");
  const connectionId = String(body.social_connection_id || "");
  if (!contentItemId || !connectionId) return NextResponse.json({ error: "content_item_id and social_connection_id are required." }, { status: 400 });

  try {
    const { item, connection, asset } = await loadPublishContext(auth.admin, contentItemId, connectionId);
    const published = await publishToConnection(auth.admin, item, connection, asset);
    await auth.admin.from("content_items").update({ status: "published", published_at: new Date().toISOString(), updated_by: auth.authUser.id }).eq("id", contentItemId);
    return NextResponse.json({ ok: true, ...published });
  } catch (error) {
    await auth.admin.from("social_connections").update({ last_error: error instanceof Error ? error.message : "Publish failed." }).eq("id", connectionId);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publish failed." }, { status: 400 });
  }
}
