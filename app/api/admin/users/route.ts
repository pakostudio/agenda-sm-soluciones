import { NextResponse } from "next/server";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { generatePin, hashPin } from "@/lib/pins";
import type { Role } from "@/lib/types";

type UserPayload = {
  full_name: string;
  primary_email: string;
  secondary_emails?: string[];
  role: Role;
  pin?: string;
  color: string;
  active: boolean;
  working_hours?: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];
};

const defaultWorkingHours = () =>
  [1, 2, 3, 4, 5].map((day) => ({
    day_of_week: day,
    start_time: "09:00",
    end_time: "18:00",
    is_active: true
  }));

export async function GET(request: Request) {
  const guard = await requireActiveAdmin(request);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { service } = guard;
  const [{ data: profiles, error: profileError }, { data: authUsers }, { data: emails }, { data: pins }, { data: hours }, { data: google }] =
    await Promise.all([
      service.from("profiles").select("id, full_name, primary_email, role, color, active, last_sign_in_at, must_change_password").order("full_name"),
      service.auth.admin.listUsers(),
      service.from("user_emails").select("user_id, email, is_primary"),
      service.from("user_pins").select("user_id, expires_at, used_at").is("used_at", null),
      service.from("working_hours").select("user_id, day_of_week, start_time, end_time, is_active").order("day_of_week"),
      service.from("google_calendar_connections").select("user_id, is_active").eq("is_active", true)
    ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const authMap = new Map(authUsers?.users.map((user) => [user.id, user]) || []);
  const users = (profiles || []).map((profile) => ({
    ...profile,
    secondary_emails: (emails || []).filter((item) => item.user_id === profile.id && !item.is_primary).map((item) => item.email),
    pin_expires_at: (pins || []).find((item) => item.user_id === profile.id)?.expires_at || null,
    google_connected: (google || []).some((item) => item.user_id === profile.id && item.is_active),
    last_sign_in_at: profile.last_sign_in_at || authMap.get(profile.id)?.last_sign_in_at || null,
    working_hours: (hours || []).filter((item) => item.user_id === profile.id)
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const guard = await requireActiveAdmin(request);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await request.json()) as UserPayload;
  if (!body.full_name || !body.primary_email || !body.role || !body.color) {
    return NextResponse.json({ error: "full_name, primary_email, role and color are required." }, { status: 400 });
  }

  const pin = body.pin || generatePin();
  const { salt, hash } = hashPin(pin);

  const existingUsers = await guard.service.auth.admin.listUsers();
  const existingUser = existingUsers.data?.users.find((user) => user.email?.toLowerCase() === body.primary_email.toLowerCase());
  let userId = existingUser?.id;

  if (userId) {
    const { data: existingProfile } = await guard.service
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      return NextResponse.json(
        {
          error:
            "El email ya existe en Supabase Auth pero no tiene perfil de Agenda SM. No se modifico para proteger otros proyectos del Supabase compartido."
        },
        { status: 409 }
      );
    }

    const authUpdate = await guard.service.auth.admin.updateUserById(userId, {
      password: pin,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
        source_app: "agenda-sm",
        must_change_password: true
      },
      app_metadata: {
        source_app: "agenda-sm"
      }
    });

    if (authUpdate.error) {
      return NextResponse.json({ error: authUpdate.error.message }, { status: 500 });
    }
  } else {
    const created = await guard.service.auth.admin.createUser({
      email: body.primary_email,
      password: pin,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
        source_app: "agenda-sm",
        must_change_password: true
      },
      app_metadata: {
        source_app: "agenda-sm"
      }
    });

    if (created.error || !created.data.user) {
      return NextResponse.json({ error: created.error?.message || "Could not create user." }, { status: 500 });
    }

    userId = created.data.user.id;
  }

  const { error: profileError } = await guard.service.from("profiles").upsert({
    id: userId,
    full_name: body.full_name,
    primary_email: body.primary_email,
    role: body.role,
    color: body.color,
    active: body.active,
    must_change_password: true
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  await guard.service.from("user_emails").delete().eq("user_id", userId);
  await guard.service.from("user_emails").insert([
    { user_id: userId, email: body.primary_email, type: "primary", is_primary: true, verified: true },
    ...(body.secondary_emails || []).filter(Boolean).map((email) => ({ user_id: userId, email, type: "secondary", is_primary: false }))
  ]);

  await guard.service.from("user_pins").insert({
    user_id: userId,
    pin_hash: hash,
    pin_salt: salt,
    created_by: guard.adminUser.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  await guard.service.from("working_hours").delete().eq("user_id", userId);
  await guard.service.from("working_hours").insert((body.working_hours?.length ? body.working_hours : defaultWorkingHours()).map((item) => ({ ...item, user_id: userId })));

  return NextResponse.json({
    user_id: userId,
    temporary_pin: pin,
    email_sent: false,
    message: existingUser
      ? "Usuario existente actualizado en Agenda SM sin envio de email automatico."
      : "Usuario creado con email confirmado sin envio de email automatico."
  });
}
