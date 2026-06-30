import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireActiveAdmin } from "@/lib/admin-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireActiveAdmin(request);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { data: profile, error: profileError } = await guard.service
    .from("profiles")
    .select("primary_email, full_name")
    .eq("id", id)
    .single();

  if (profileError || !profile) return NextResponse.json({ error: profileError?.message || "User not found." }, { status: 404 });

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({
      sent: false,
      warning: "Resend no configurado; usuario creado sin envío de invitación"
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agenda.smsoluciones.com";
  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: profile.primary_email,
    subject: "Invitacion a Agenda SM",
    text: [
      `Hola ${profile.full_name},`,
      "",
      "Tu usuario de Agenda SM ya fue creado.",
      `Entra en: ${appUrl}`,
      "",
      "Usa el PIN temporal que te entregue el administrador. Despues del primer acceso, cambia tu contrasena desde Agenda SM.",
      "",
      "Google Calendar se conecta desde Agenda SM solo para consultar disponibilidad Free/Busy."
    ].join("\n")
  });

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  return NextResponse.json({ sent: true });
}
