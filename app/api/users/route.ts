import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request.headers.get("authorization"));
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = ["admin", "editor", "viewer"].includes(body.role) ? body.role : "editor";
    const active = Boolean(body.active);

    if (!fullName || !email || password.length < 8) {
      return NextResponse.json({ error: "Nombre, correo y contraseña de 8 caracteres son obligatorios." }, { status: 400 });
    }

    const created = await auth.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (created.error || !created.data.user) {
      return NextResponse.json({ error: created.error?.message || "No fue posible crear el usuario." }, { status: 400 });
    }

    const profile = await auth.admin.from("profiles").upsert({
      id: created.data.user.id,
      full_name: fullName,
      email,
      role,
      active
    });

    if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: created.data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
