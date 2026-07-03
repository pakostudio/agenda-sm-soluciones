import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildGoogleAuthUrl, googleEnvReady, signGoogleState } from "@/lib/google-oauth";
import { adminEnvReady, getServiceClient } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!adminEnvReady || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  }
  if (!googleEnvReady) {
    return NextResponse.json({ error: "Google Calendar no configurado." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });

  const service = getServiceClient();
  const { data: profile } = await service.from("profiles").select("active").eq("id", userData.user.id).single();
  if (!profile?.active) return NextResponse.json({ error: "Usuario inactivo." }, { status: 403 });

  return NextResponse.json({ authUrl: buildGoogleAuthUrl(signGoogleState(userData.user.id)) });
}
