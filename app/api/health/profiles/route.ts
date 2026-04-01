/**
 * GET /api/health/profiles
 *
 * Returns public profile URLs for each connected platform.
 * Used by the sidebar to open the account page on click.
 *
 * Response shape:
 *   {
 *     youtube:   { url: string | null; handle?: string }
 *     tiktok:    { url: string | null; openId?: string }
 *     instagram: { url: string | null; accountId?: string }
 *   }
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getYouTubeProfile(): Promise<{ url: string | null; handle?: string }> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    return { url: null };
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });

    const yt = google.youtube({ version: "v3", auth });

    const res = await yt.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const channel = res.data.items?.[0];
    if (!channel) return { url: null };

    const channelId = channel.id;
    const handle = channel.snippet?.customUrl; // e.g. "@mychannel"

    return {
      url: handle
        ? `https://youtube.com/${handle}`
        : `https://youtube.com/channel/${channelId}`,
      handle: handle ?? undefined,
    };
  } catch {
    return { url: null };
  }
}

async function getTikTokProfile(): Promise<{ url: string | null; openId?: string }> {
  const { TIKTOK_OPEN_ID } = process.env;
  if (!TIKTOK_OPEN_ID) return { url: null };

  // TikTok profile URL by open_id isn't publicly constructable without username.
  // Best we can do is link to the creator portal.
  return {
    url: "https://www.tiktok.com/creator-center",
    openId: TIKTOK_OPEN_ID,
  };
}

async function getInstagramProfile(): Promise<{ url: string | null; accountId?: string }> {
  const { INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN } = process.env;
  if (!INSTAGRAM_BUSINESS_ACCOUNT_ID || !INSTAGRAM_ACCESS_TOKEN) return { url: null };

  try {
    // Fetch username from Graph API
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=username&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) {
      return { url: "https://instagram.com", accountId: INSTAGRAM_BUSINESS_ACCOUNT_ID };
    }
    const data = await res.json() as { username?: string };
    return {
      url: data.username ? `https://instagram.com/${data.username}` : "https://instagram.com",
      accountId: INSTAGRAM_BUSINESS_ACCOUNT_ID,
    };
  } catch {
    return { url: "https://instagram.com", accountId: INSTAGRAM_BUSINESS_ACCOUNT_ID };
  }
}

export async function GET() {
  const [youtube, tiktok, instagram] = await Promise.all([
    getYouTubeProfile(),
    getTikTokProfile(),
    getInstagramProfile(),
  ]);

  return NextResponse.json({ youtube, tiktok, instagram });
}
