import { NextResponse } from "next/server";
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

  const invite = await guard.service.auth.admin.inviteUserByEmail(profile.primary_email, {
    data: { full_name: profile.full_name, must_change_password: true },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`
  });

  if (invite.error) return NextResponse.json({ error: invite.error.message }, { status: 500 });

  return NextResponse.json({ sent: true });
}
