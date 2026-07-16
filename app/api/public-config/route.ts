import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    supabase: {
      configured: Boolean(url && anonKey),
      url: url || "",
      anonKey: anonKey || ""
    }
  });
}
