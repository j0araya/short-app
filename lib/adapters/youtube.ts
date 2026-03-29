/**
 * YouTubeAdapter
 *
 * Implements PlatformAdapter for YouTube Shorts.
 * Requires YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN in .env
 *
 * In v1 this is a stub — replace the upload method body with the real
 * YouTube Data API v3 resumable upload once OAuth is configured.
 */

import type { PlatformAdapter, PlatformStats, UploadResult } from "./types";

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = "youtube";

  async upload(
    jobId: string,
    videoPath: string,
    title: string
  ): Promise<UploadResult> {
    // TODO: implement real YouTube Data API v3 upload
    // 1. Get OAuth2 token using refresh token from .env
    // 2. POST to https://www.googleapis.com/upload/youtube/v3/videos
    //    with part=snippet,status and #shorts in title/description
    // 3. Return { externalId: video.id, url: `https://youtu.be/${video.id}`, platform }

    console.log(`[YouTubeAdapter] stub upload — jobId: ${jobId}, path: ${videoPath}`);

    return {
      externalId: `stub_${jobId}`,
      url: `https://youtube.com/shorts/stub_${jobId}`,
      platform: this.platform,
    };
  }

  async getStats(externalId: string): Promise<PlatformStats> {
    // TODO: implement YouTube Analytics API call
    console.log(`[YouTubeAdapter] stub getStats — externalId: ${externalId}`);
    return { views: 0, likes: 0 };
  }
}
