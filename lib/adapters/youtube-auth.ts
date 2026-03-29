/**
 * YouTube OAuth2 client
 *
 * Reuses YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN from .env.
 * Singleton pattern — safe across Next.js hot-reloads.
 */

import { google } from "googleapis";
import type { youtube_v3 } from "googleapis";

function createYouTubeClient(): youtube_v3.Youtube {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;

  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error(
      "Missing YouTube credentials. Set YOUTUBE_CLIENT_ID, " +
        "YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN in .env"
    );
  }

  const auth = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });

  return google.youtube({ version: "v3", auth });
}

const globalForYouTube = globalThis as unknown as { youtube: youtube_v3.Youtube | null };

export function getYouTubeClient(): youtube_v3.Youtube {
  if (!globalForYouTube.youtube) {
    globalForYouTube.youtube = createYouTubeClient();
  }
  return globalForYouTube.youtube;
}
