import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request.headers.get("authorization"));
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const brandId = request.nextUrl.searchParams.get("brand_id");
  const query = auth.admin
    .from("social_connections")
    .select("id, brand_id, network, provider, account_id, account_name, account_type, scopes, status, metadata, last_error, token_expires_at, refresh_expires_at, updated_at")
    .order("updated_at", { ascending: false });
  if (brandId) query.eq("brand_id", brandId);
  const result = await query;
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ connections: result.data || [] });
}
