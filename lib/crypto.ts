import crypto from "node:crypto";

const getKey = () => {
  const secret = process.env.OAUTH_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("OAUTH_ENCRYPTION_KEY must be at least 32 characters.");
  return crypto.createHash("sha256").update(secret).digest();
};

export const encryptSecret = (value: string | null | undefined) => {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
};

export const decryptSecret = (value: string | null | undefined) => {
  if (!value) return null;
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted token.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
};

export const signState = (payload: Record<string, string>) => {
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", getKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
};

export const verifyState = (state: string) => {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid OAuth state.");
  const expected = crypto.createHmac("sha256", getKey()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("Invalid OAuth state signature.");
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (Date.now() - parsed.ts > 15 * 60 * 1000) throw new Error("OAuth state expired.");
  return parsed as Record<string, string | number>;
};
