import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const getSupabaseAdmin = () => {
  if (!url || !serviceRole) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const requireAdmin = async (authorization: string | null) => {
  const token = authorization?.replace("Bearer ", "");
  if (!token) return { error: "Missing authorization token.", status: 401 as const };

  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { error: "Invalid session.", status: 401 as const };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile?.active || profile.role !== "admin") {
    return { error: "Admin role required.", status: 403 as const };
  }

  return { admin, authUser: userData.user };
};

export const requireStaff = async (authorization: string | null) => {
  const token = authorization?.replace("Bearer ", "");
  if (!token) return { error: "Missing authorization token.", status: 401 as const };

  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { error: "Invalid session.", status: 401 as const };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, active")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile?.active || !["admin", "editor"].includes(profile.role)) {
    return { error: "Editor role required.", status: 403 as const };
  }

  return { admin, authUser: userData.user, profile };
};
