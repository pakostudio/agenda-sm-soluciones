import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
    const providedSecret = request.headers.get("x-bootstrap-secret");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Bootstrap secret required." }, { status: 403 });
    }

    const body = await request.json();
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!fullName || !email || password.length < 8) {
      return NextResponse.json({ error: "Nombre, correo y contraseña de 8 caracteres son obligatorios." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: existingProfiles, error: countError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("active", true)
      .limit(1);

    if (countError) return NextResponse.json({ error: countError.message }, { status: 400 });
    if (existingProfiles && existingProfiles.length > 0) {
      return NextResponse.json({ error: "Ya existe un admin activo. Usa Ajustes > Usuarios." }, { status: 409 });
    }

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (created.error || !created.data.user) {
      return NextResponse.json({ error: created.error?.message || "No fue posible crear el admin." }, { status: 400 });
    }

    const profile = await admin.from("profiles").upsert({
      id: created.data.user.id,
      full_name: fullName,
      email,
      role: "admin",
      active: true
    });

    if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: created.data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
