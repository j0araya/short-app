/**
 * TikTok OAuth2 token manager
 *
 * Manages access token lifecycle for the TikTok Content Posting API.
 * Tokens are short-lived (~24h); this module auto-refreshes via the
 * stored refresh token before each use.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY      — App client key from TikTok developer portal
 *   TIKTOK_CLIENT_SECRET   — App client secret from TikTok developer portal
 *   TIKTOK_ACCESS_TOKEN    — Current access token (updated on refresh)
 *   TIKTOK_REFRESH_TOKEN   — Long-lived refresh token
 *   TIKTOK_OPEN_ID         — Creator's open_id returned during first OAuth flow
 */

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in: number;       // seconds
  refresh_expires_in: number;
  token_type: string;
  scope: string;
}

interface TikTokTokenState {
  accessToken: string;
  refreshToken: string;
  openId: string;
  /** Unix timestamp (ms) after which the access token should be refreshed */
  expiresAt: number;
}

function loadFromEnv(): TikTokTokenState {
  const {
    TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET,
    TIKTOK_ACCESS_TOKEN,
    TIKTOK_REFRESH_TOKEN,
    TIKTOK_OPEN_ID,
  } = process.env;

  if (
    !TIKTOK_CLIENT_KEY ||
    !TIKTOK_CLIENT_SECRET ||
    !TIKTOK_ACCESS_TOKEN ||
    !TIKTOK_REFRESH_TOKEN ||
    !TIKTOK_OPEN_ID
  ) {
    throw new Error(
      "[TikTokAuth] Missing credentials. Set TIKTOK_CLIENT_KEY, " +
        "TIKTOK_CLIENT_SECRET, TIKTOK_ACCESS_TOKEN, TIKTOK_REFRESH_TOKEN, " +
        "and TIKTOK_OPEN_ID in .env"
    );
  }

  return {
    accessToken: TIKTOK_ACCESS_TOKEN,
    refreshToken: TIKTOK_REFRESH_TOKEN,
    openId: TIKTOK_OPEN_ID,
    // Treat tokens from env as already needing validation — expire immediately
    // so the first call always refreshes (safe default).
    expiresAt: Date.now() - 1,
  };
}

async function refreshAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string
): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[TikTokAuth] Token refresh failed (${res.status}): ${text}`
    );
  }

  const data = (await res.json()) as TikTokTokenResponse;

  if (!data.access_token) {
    throw new Error(
      `[TikTokAuth] Token refresh returned no access_token: ${JSON.stringify(data)}`
    );
  }

  return data;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalForTikTok = globalThis as unknown as {
  tiktokTokenState: TikTokTokenState | null;
};

/**
 * Returns a valid TikTok access token, refreshing it if necessary.
 * Also returns the creator's open_id needed for API calls.
 */
export async function getTikTokToken(): Promise<{
  accessToken: string;
  openId: string;
}> {
  if (!globalForTikTok.tiktokTokenState) {
    globalForTikTok.tiktokTokenState = loadFromEnv();
  }

  const state = globalForTikTok.tiktokTokenState;

  // Refresh if expired (with a 60s buffer)
  if (Date.now() >= state.expiresAt - 60_000) {
    const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = process.env;

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      throw new Error("[TikTokAuth] TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET missing");
    }

    console.log("[TikTokAuth] Access token expired or unvalidated — refreshing…");

    const tokens = await refreshAccessToken(
      TIKTOK_CLIENT_KEY,
      TIKTOK_CLIENT_SECRET,
      state.refreshToken
    );

    state.accessToken = tokens.access_token;
    state.refreshToken = tokens.refresh_token;
    state.openId = tokens.open_id ?? state.openId;
    state.expiresAt = Date.now() + tokens.expires_in * 1_000;

    console.log(
      `[TikTokAuth] Token refreshed. Expires in ${Math.round(tokens.expires_in / 3600)}h`
    );
  }

  return { accessToken: state.accessToken, openId: state.openId };
}
