import { decryptSecret } from "@/lib/crypto";
import { refreshConnectionToken } from "@/lib/social-providers";

const asCaption = (item: any) => [item.copy_text, item.hashtags, item.cta].filter(Boolean).join("\n\n").slice(0, 2200);

export const getFreshAccessToken = async (admin: any, connection: any) => {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() < 10 * 60 * 1000 && connection.refresh_token_encrypted) {
    const refreshed = await refreshConnectionToken(connection);
    if (typeof refreshed === "string") return refreshed;
    if (!refreshed) throw new Error("Token refresh failed.");
    await admin.from("social_connections").update({
      access_token_encrypted: refreshed.accessTokenEncrypted,
      refresh_token_encrypted: refreshed.refreshTokenEncrypted,
      token_expires_at: refreshed.expiresAt,
      refresh_expires_at: refreshed.refreshExpiresAt,
      last_error: null
    }).eq("id", connection.id);
    return refreshed.accessToken;
  }
  const token = decryptSecret(connection.access_token_encrypted);
  if (!token) throw new Error("Missing access token.");
  return token;
};

export const publishToConnection = async (admin: any, item: any, connection: any, asset?: any) => {
  const token = await getFreshAccessToken(admin, connection);
  if (connection.provider === "meta") return publishInstagram(item, connection, asset, token);
  if (connection.provider === "linkedin") return publishLinkedIn(item, connection, token);
  if (connection.provider === "tiktok") return publishTikTok(item, connection, asset, token);
  throw new Error(`Unsupported provider ${connection.provider}`);
};

const publishInstagram = async (item: any, connection: any, asset: any, token: string) => {
  if (!asset?.public_url) throw new Error("Instagram publishing requires a selected image or video with signed URL.");
  const params = new URLSearchParams({ access_token: token, caption: asCaption(item) });
  if (asset.asset_type === "video") {
    params.set("media_type", "REELS");
    params.set("video_url", asset.public_url);
  } else {
    params.set("image_url", asset.public_url);
  }
  const create = await fetch(`https://graph.facebook.com/v20.0/${connection.account_id}/media`, { method: "POST", body: params }).then((res) => res.json());
  if (create.error) throw new Error(create.error.message || "Instagram container creation failed.");
  const publish = await fetch(`https://graph.facebook.com/v20.0/${connection.account_id}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ access_token: token, creation_id: create.id })
  }).then((res) => res.json());
  if (publish.error) throw new Error(publish.error.message || "Instagram publish failed.");
  return { provider_post_id: publish.id, response: publish };
};

const publishLinkedIn = async (item: any, connection: any, token: string) => {
  const author = connection.account_type === "organization" ? `urn:li:organization:${connection.account_id}` : `urn:li:person:${connection.account_id}`;
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202606",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify({
      author,
      commentary: asCaption(item),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || "LinkedIn publish failed.");
  return { provider_post_id: response.headers.get("x-restli-id") || "", response: text ? JSON.parse(text) : { status: response.status } };
};

const publishTikTok = async (item: any, connection: any, asset: any, token: string) => {
  if (!asset?.public_url || asset.asset_type !== "video") throw new Error("TikTok Direct Post requires a selected video with signed URL.");
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      post_info: {
        title: asCaption(item),
        privacy_level: connection.metadata?.privacy_level || "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: asset.public_url
      }
    })
  }).then((res) => res.json());
  if (response.error?.code && response.error.code !== "ok") throw new Error(response.error.message || "TikTok publish failed.");
  return { provider_post_id: response.data?.publish_id || "", response };
};
