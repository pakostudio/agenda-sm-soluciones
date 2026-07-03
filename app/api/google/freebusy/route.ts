import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminEnvReady, getServiceClient } from "@/lib/admin-auth";
import { refreshGoogleToken } from "@/lib/google-oauth";

type FreeBusyBody = {
  timeMin?: string;
  timeMax?: string;
  userIds?: string[];
};

export async function POST(request: Request) {
  if (!adminEnvReady || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      users: {},
      warning: "Supabase no configurado; la app continua con disponibilidad interna."
    });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const body = (await request.json()) as FreeBusyBody;

  if (!body.timeMin || !body.timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
  }

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });

  const userIds = body.userIds?.length ? body.userIds : [userData.user.id];
  const service = getServiceClient();
  const { data: profile } = await service.from("profiles").select("active").eq("id", userData.user.id).single();
  if (!profile?.active) return NextResponse.json({ error: "Usuario inactivo." }, { status: 403 });

  const { data: connections } = await service
    .from("google_calendar_connections")
    .select("user_id, calendar_id, access_token, refresh_token, expires_at, is_active")
    .in("user_id", userIds)
    .eq("is_active", true);

  const users: Record<string, { connected: boolean; busy: { start: string; end: string }[] }> = {};
  for (const userId of userIds) {
    const connection = connections?.find((item) => item.user_id === userId);
    if (!connection?.access_token) {
      users[userId] = { connected: false, busy: [] };
      continue;
    }

    let accessToken = connection.access_token;
    const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
    if (connection.refresh_token && expiresAt && expiresAt < Date.now() + 60_000) {
      const refreshed = await refreshGoogleToken(connection.refresh_token);
      accessToken = refreshed.access_token;
      await service
        .from("google_calendar_connections")
        .update({
          access_token: accessToken,
          expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : connection.expires_at
        })
        .eq("user_id", userId)
        .eq("calendar_id", connection.calendar_id || "primary");
    }

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: body.timeMin,
        timeMax: body.timeMax,
        items: [{ id: connection.calendar_id || "primary" }]
      })
    });

    if (!response.ok) {
      users[userId] = { connected: true, busy: [] };
      continue;
    }

    const data = await response.json();
    const calendar = data.calendars?.[connection.calendar_id || "primary"] as { busy?: { start: string; end: string }[] } | undefined;
    users[userId] = { connected: true, busy: calendar?.busy || [] };
  }

  return NextResponse.json({
    users,
    warning: Object.values(users).some((item) => !item.connected)
      ? "Google Calendar no conectado para uno o mas usuarios; se uso Agenda SM y horario laboral."
      : ""
  });
}
