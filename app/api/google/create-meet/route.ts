import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminEnvReady, getServiceClient } from "@/lib/admin-auth";
import { refreshGoogleToken } from "@/lib/google-oauth";

type MeetBody = {
  responsible_user_id?: string;
  title?: string;
  start_at?: string;
  end_at?: string;
  notes?: string | null;
};

export async function POST(request: Request) {
  if (!adminEnvReady || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const body = (await request.json()) as MeetBody;
  if (!body.responsible_user_id || !body.title || !body.start_at || !body.end_at) {
    return NextResponse.json({ error: "Datos incompletos para crear Meet." }, { status: 400 });
  }

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });

  const service = getServiceClient();
  const { data: actor } = await service.from("profiles").select("id, role, active").eq("id", userData.user.id).single();
  if (!actor?.active) return NextResponse.json({ error: "Usuario inactivo." }, { status: 403 });
  if (actor.role !== "admin" && actor.id !== body.responsible_user_id) {
    return NextResponse.json({ error: "Solo Admin o el responsable pueden crear Meet." }, { status: 403 });
  }

  const { data: connection } = await service
    .from("google_calendar_connections")
    .select("user_id, calendar_id, access_token, refresh_token, expires_at")
    .eq("user_id", body.responsible_user_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!connection?.access_token) {
    return NextResponse.json({ error: "El responsable no tiene Google Calendar conectado." }, { status: 409 });
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
      .eq("user_id", body.responsible_user_id)
      .eq("calendar_id", connection.calendar_id || "primary");
  }

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id || "primary")}/events?conferenceDataVersion=1&sendUpdates=none`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: body.title,
      description: body.notes || "Cita creada desde Agenda SM.",
      start: { dateTime: body.start_at },
      end: { dateTime: body.end_at },
      conferenceData: {
        createRequest: {
          requestId: `agenda-sm-${crypto.randomUUID()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "La cita se creo, pero no se pudo generar Meet." }, { status: 502 });
  }

  const event = await response.json();
  return NextResponse.json({
    google_event_id: event.id || null,
    meet_url: event.hangoutLink || event.conferenceData?.entryPoints?.find((item: { uri?: string }) => item.uri)?.uri || null
  });
}
