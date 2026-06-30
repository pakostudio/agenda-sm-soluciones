import { NextResponse } from "next/server";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { generatePin, hashPin } from "@/lib/pins";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireActiveAdmin(request);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { data: existingProfile, error: existingProfileError } = await guard.service
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existingProfileError) return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  if (!existingProfile) {
    return NextResponse.json({ error: "Agenda SM user profile not found. No shared Supabase Auth user was modified." }, { status: 404 });
  }

  const pin = generatePin();
  const { salt, hash } = hashPin(pin);

  await guard.service.from("user_pins").update({ used_at: new Date().toISOString() }).eq("user_id", id).is("used_at", null);
  const { error } = await guard.service.from("user_pins").insert({
    user_id: id,
    pin_hash: hash,
    pin_salt: salt,
    created_by: guard.adminUser.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await guard.service.from("profiles").update({ must_change_password: true }).eq("id", id);
  const authUpdate = await guard.service.auth.admin.updateUserById(id, {
    password: pin,
    user_metadata: {
      must_change_password: true
    }
  });

  if (authUpdate.error) return NextResponse.json({ error: authUpdate.error.message }, { status: 500 });

  return NextResponse.json({ temporary_pin: pin });
}
