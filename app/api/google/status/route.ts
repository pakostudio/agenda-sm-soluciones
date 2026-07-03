import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminEnvReady, getServiceClient } from "@/lib/admin-auth";
import { googleEnvReady } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const configured = adminEnvReady && googleEnvReady;

  if (!adminEnvReady || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ connected: false, configured });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ connected: false, configured }, { status: 401 });

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error } = await authClient.auth.getUser(token);
  if (error || !userData.user) return NextResponse.json({ connected: false, configured }, { status: 401 });

  const service = getServiceClient();
  const { data } = await service
    .from("google_calendar_connections")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({ connected: Boolean(data), configured });
}
