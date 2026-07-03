import { NextResponse } from "next/server";
import { exchangeGoogleCode, verifyGoogleState } from "@/lib/google-oauth";
import { getServiceClient } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const userId = state ? verifyGoogleState(state) : null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}?google=error`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const service = getServiceClient();
    const { data: profile } = await service.from("profiles").select("primary_email").eq("id", userId).single();
    await service.from("google_calendar_connections").upsert({
      user_id: userId,
      google_account_email: profile?.primary_email || "connected",
      calendar_id: "primary",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      is_active: true
    }, { onConflict: "user_id,calendar_id" });

    return NextResponse.redirect(`${appUrl}?google=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}?google=error`);
  }
}
