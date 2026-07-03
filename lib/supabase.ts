import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export let isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export let supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export const getSupabaseBrowserClient = async () => {
  if (supabase) return supabase;
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch("/api/public-config", { cache: "no-store" });
    const config = await response.json();
    if (!response.ok || !config.supabase?.configured) return null;

    supabase = createClient(config.supabase.url, config.supabase.anonKey);
    isSupabaseConfigured = true;
    return supabase;
  } catch {
    return null;
  }
};

export const getSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return supabase;
};
