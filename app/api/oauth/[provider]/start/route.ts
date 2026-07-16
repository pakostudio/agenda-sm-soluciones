import { NextRequest, NextResponse } from "next/server";
import { signState } from "@/lib/crypto";
import { getProviderCredentials, getRedirectUri, providerConfig, type Provider } from "@/lib/social-providers";
import { requireAdmin } from "@/lib/supabase-admin";

const networks: Record<Provider, string> = { meta: "instagram", linkedin: "linkedin", tiktok: "tiktok" };

export async function GET() {
  return NextResponse.json({ error: "Use authenticated POST." }, { status: 405 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const params = await context.params;
  const provider = params.provider as Provider;
  if (!["meta", "linkedin", "tiktok"].includes(provider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  const auth = await requireAdmin(request.headers.get("authorization"));
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const brandId = String(body.brand_id || "");
  if (!brandId) return NextResponse.json({ error: "brand_id is required." }, { status: 400 });
  const credentials = getProviderCredentials(provider);
  if (!credentials.clientId || !credentials.clientSecret) return NextResponse.json({ error: `Missing ${provider} OAuth credentials.` }, { status: 500 });

  const url = new URL(providerConfig[provider].authorizeUrl);
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("redirect_uri", getRedirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", providerConfig[provider].scopes.join(provider === "tiktok" ? "," : " "));
  url.searchParams.set("state", signState({ brand_id: brandId, provider, network: networks[provider] }));
  if (provider === "tiktok") url.searchParams.set("disable_auto_auth", "1");

  return NextResponse.json({ url: url.toString() });
}
