import { NextRequest, NextResponse } from "next/server";
import { encryptSecret, verifyState } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { exchangeCode, type Provider } from "@/lib/social-providers";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "https://agenda-sm-soluciones-github.vercel.app").replace(/\/$/, "");

const getMetaAccounts = async (accessToken: string) => {
  const pages = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(accessToken)}`).then((res) => res.json());
  if (pages.error) throw new Error(pages.error.message || "Meta accounts fetch failed.");
  return (pages.data || [])
    .filter((page: any) => page.instagram_business_account?.id && page.access_token)
    .map((page: any) => ({
      account_id: page.instagram_business_account.id,
      account_name: page.instagram_business_account.username || page.instagram_business_account.name || page.name,
      account_type: "instagram_business",
      access_token: page.access_token,
      metadata: { page_id: page.id, page_name: page.name, instagram: page.instagram_business_account }
    }));
};

const getLinkedInAccounts = async (accessToken: string) => {
  const headers = { Authorization: `Bearer ${accessToken}`, "LinkedIn-Version": "202606", "X-Restli-Protocol-Version": "2.0.0" };
  const userInfo = await fetch("https://api.linkedin.com/v2/userinfo", { headers }).then((res) => res.json());
  const accounts: any[] = [{
    account_id: userInfo.sub,
    account_name: userInfo.name || userInfo.email || "LinkedIn member",
    account_type: "member",
    access_token: accessToken,
    metadata: { userinfo: userInfo }
  }];
  const orgs = await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&projection=(elements*(organization~(id,localizedName),role,state))", { headers }).then((res) => res.json()).catch(() => null);
  for (const element of orgs?.elements || []) {
    if (element.state === "APPROVED" && element["organization~"]?.id) {
      accounts.push({
        account_id: String(element["organization~"].id),
        account_name: element["organization~"].localizedName || `Organization ${element["organization~"].id}`,
        account_type: "organization",
        access_token: accessToken,
        metadata: { acl: element }
      });
    }
  }
  return accounts;
};

const getTikTokAccounts = async (accessToken: string) => {
  const user = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).then((res) => res.json());
  if (user.error?.code && user.error.code !== "ok") throw new Error(user.error.message || "TikTok user fetch failed.");
  const info = user.data?.user || {};
  return [{
    account_id: info.open_id,
    account_name: info.display_name || "TikTok user",
    account_type: "creator",
    access_token: accessToken,
    metadata: { user: info }
  }];
};

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const params = await context.params;
    const provider = params.provider as Provider;
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) throw new Error("Missing OAuth code or state.");
    const parsed = verifyState(state);
    if (parsed.provider !== provider) throw new Error("OAuth provider mismatch.");

    const token = await exchangeCode(provider, code);
    const accounts =
      provider === "meta"
        ? await getMetaAccounts(token.accessToken)
        : provider === "linkedin"
          ? await getLinkedInAccounts(token.accessToken)
          : await getTikTokAccounts(token.accessToken);

    const admin = getSupabaseAdmin();
    for (const account of accounts) {
      await admin.from("social_connections").upsert({
        brand_id: parsed.brand_id,
        network: parsed.network,
        provider,
        account_id: account.account_id,
        account_name: account.account_name,
        account_type: account.account_type,
        access_token_encrypted: encryptSecret(account.access_token),
        refresh_token_encrypted: encryptSecret(token.refreshToken),
        token_expires_at: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : null,
        refresh_expires_at: token.refreshExpiresIn ? new Date(Date.now() + token.refreshExpiresIn * 1000).toISOString() : null,
        scopes: token.scopes,
        status: "connected",
        metadata: account.metadata
      }, { onConflict: "brand_id,network,provider,account_id" });
    }

    return NextResponse.redirect(`${appUrl()}/?connected=${provider}`);
  } catch (error) {
    return NextResponse.redirect(`${appUrl()}/?connection_error=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`);
  }
}
