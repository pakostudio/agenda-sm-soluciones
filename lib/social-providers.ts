import { decryptSecret, encryptSecret } from "@/lib/crypto";

export type Provider = "meta" | "linkedin" | "tiktok";

export const providerConfig = {
  meta: {
    authorizeUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"]
  },
  linkedin: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social", "r_organization_social", "w_organization_social"]
  },
  tiktok: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.publish", "video.upload"]
  }
} as const;

export const getProviderCredentials = (provider: Provider) => {
  if (provider === "meta") return { clientId: process.env.META_APP_ID, clientSecret: process.env.META_APP_SECRET };
  if (provider === "linkedin") return { clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET };
  return { clientId: process.env.TIKTOK_CLIENT_KEY, clientSecret: process.env.TIKTOK_CLIENT_SECRET };
};

export const getRedirectUri = (provider: Provider) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required.");
  return `${appUrl.replace(/\/$/, "")}/api/oauth/${provider}/callback`;
};

export const exchangeCode = async (provider: Provider, code: string) => {
  const credentials = getProviderCredentials(provider);
  if (!credentials.clientId || !credentials.clientSecret) throw new Error(`Missing ${provider} OAuth credentials.`);
  const redirectUri = getRedirectUri(provider);

  if (provider === "meta") {
    const url = new URL(providerConfig.meta.tokenUrl);
    url.searchParams.set("client_id", credentials.clientId);
    url.searchParams.set("client_secret", credentials.clientSecret);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);
    const shortToken = await fetch(url).then((res) => res.json());
    if (shortToken.error) throw new Error(shortToken.error.message || "Meta token exchange failed.");
    const longUrl = new URL(providerConfig.meta.tokenUrl);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", credentials.clientId);
    longUrl.searchParams.set("client_secret", credentials.clientSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
    const longToken = await fetch(longUrl).then((res) => res.json());
    if (longToken.error) throw new Error(longToken.error.message || "Meta long token exchange failed.");
    return { accessToken: longToken.access_token, refreshToken: null, expiresIn: longToken.expires_in as number | undefined, scopes: providerConfig.meta.scopes };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret
  });
  const token = await fetch(providerConfig[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  }).then((res) => res.json());
  if (token.error) throw new Error(token.error_description || token.error.message || token.error);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresIn: token.expires_in as number | undefined,
    refreshExpiresIn: token.refresh_expires_in as number | undefined,
    scopes: String(token.scope || providerConfig[provider].scopes.join(" ")).split(/[,\s]+/).filter(Boolean)
  };
};

export const refreshConnectionToken = async (connection: any) => {
  const provider = connection.provider as Provider;
  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  if (!refreshToken) return decryptSecret(connection.access_token_encrypted);
  const credentials = getProviderCredentials(provider);
  if (!credentials.clientId || !credentials.clientSecret) throw new Error(`Missing ${provider} OAuth credentials.`);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret
  });
  const token = await fetch(providerConfig[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  }).then((res) => res.json());
  if (token.error) throw new Error(token.error_description || token.error.message || token.error);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
    accessTokenEncrypted: encryptSecret(token.access_token),
    refreshTokenEncrypted: encryptSecret(token.refresh_token || refreshToken),
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    refreshExpiresAt: token.refresh_expires_in ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString() : null
  };
};
