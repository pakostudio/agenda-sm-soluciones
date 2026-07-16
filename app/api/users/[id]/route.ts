import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request.headers.get("authorization"));
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const body = await request.json();
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = ["admin", "editor", "viewer"].includes(body.role) ? body.role : "editor";
    const active = Boolean(body.active);

    if (!fullName || !email) {
      return NextResponse.json({ error: "Nombre y correo son obligatorios." }, { status: 400 });
    }

    const authPayload: { email: string; password?: string; user_metadata: { full_name: string } } = {
      email,
      user_metadata: { full_name: fullName }
    };
    if (password) {
      if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
      authPayload.password = password;
    }

    const updatedAuth = await auth.admin.auth.admin.updateUserById(id, authPayload);
    if (updatedAuth.error) return NextResponse.json({ error: updatedAuth.error.message }, { status: 400 });

    const profile = await auth.admin.from("profiles").update({
      full_name: fullName,
      email,
      role,
      active
    }).eq("id", id);

    if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
