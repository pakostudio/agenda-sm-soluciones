import { createHmac, timingSafeEqual } from "crypto";

const scope = "https://www.googleapis.com/auth/calendar.freebusy";

export const googleEnvReady = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    (process.env.GOOGLE_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL)
);

export const getGoogleRedirectUri = () => {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  if (process.env.NEXT_PUBLIC_APP_URL) return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/google/callback`;
  throw new Error("Missing GOOGLE_REDIRECT_URI or NEXT_PUBLIC_APP_URL.");
};

const secret = () => process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "agenda-sm-dev";

export const signGoogleState = (userId: string) => {
  const issuedAt = String(Date.now());
  const payload = `${userId}.${issuedAt}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
};

export const verifyGoogleState = (state: string) => {
  const [userId, issuedAt, signature] = state.split(".");
  if (!userId || !issuedAt || !signature) return null;
  const payload = `${userId}.${issuedAt}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (signature.length !== expected.length) return null;
  const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const fresh = Date.now() - Number(issuedAt) < 15 * 60 * 1000;
  return valid && fresh ? userId : null;
};

export const buildGoogleAuthUrl = (state: string) => {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", getGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
};

export const exchangeGoogleCode = async (code: string) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth credentials.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) throw new Error("No se pudo conectar Google Calendar.");
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
};

export const refreshGoogleToken = async (refreshToken: string) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth credentials.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) throw new Error("No se pudo refrescar Google Calendar.");
  return response.json() as Promise<{ access_token: string; expires_in?: number }>;
};
