import { NextResponse } from "next/server";
import { requireActiveAdmin } from "@/lib/admin-auth";
import type { Role } from "@/lib/types";

type UpdatePayload = {
  full_name?: string;
  primary_email?: string;
  secondary_emails?: string[];
  role?: Role;
  color?: string;
  active?: boolean;
  working_hours?: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireActiveAdmin(request);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await request.json()) as UpdatePayload;
  const { id } = await params;
  const profilePatch = {
    ...(body.full_name !== undefined ? { full_name: body.full_name } : {}),
    ...(body.primary_email !== undefined ? { primary_email: body.primary_email } : {}),
    ...(body.role !== undefined ? { role: body.role } : {}),
    ...(body.color !== undefined ? { color: body.color } : {}),
    ...(body.active !== undefined ? { active: body.active } : {})
  };

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await guard.service.from("profiles").update(profilePatch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.primary_email) {
    const { error } = await guard.service.auth.admin.updateUserById(id, { email: body.primary_email });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.secondary_emails || body.primary_email) {
    const { data: profile } = await guard.service.from("profiles").select("primary_email").eq("id", id).single();
    await guard.service.from("user_emails").delete().eq("user_id", id);
    await guard.service.from("user_emails").insert([
      { user_id: id, email: profile?.primary_email || body.primary_email, type: "primary", is_primary: true, verified: true },
      ...(body.secondary_emails || []).filter(Boolean).map((email) => ({ user_id: id, email, type: "secondary", is_primary: false }))
    ]);
  }

  if (body.working_hours) {
    await guard.service.from("working_hours").delete().eq("user_id", id);
    if (body.working_hours.length > 0) {
      await guard.service.from("working_hours").insert(body.working_hours.map((item) => ({ ...item, user_id: id })));
    }
  }

  return NextResponse.json({ ok: true });
}
