/**
 * YouTubeAdapter
 *
 * Uploads MP4 files to YouTube as Shorts via Data API v3 resumable upload.
 * Config (privacyStatus, categoryId, tags, descriptionTemplate) comes from
 * project.config.ts — nothing is hardcoded here.
 *
 * Required env vars:
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 */

import fs from "fs";
import { getYouTubeClient } from "./youtube-auth";
import { projectConfig } from "@/project.config";
import type { PlatformAdapter, PlatformStats, UploadResult } from "./types";

function buildTitle(title: string): string {
  const suffix = "#Shorts";
  // YouTube title max is 100 chars
  if (title.includes(suffix)) return title.slice(0, 100);
  const candidate = `${title} ${suffix}`;
  return candidate.length <= 100 ? candidate : `${title.slice(0, 100 - suffix.length - 1)} ${suffix}`;
}

function buildDescription(title: string, template: string): string {
  return template.replace("{title}", title);
}

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = "youtube";

  async upload(
    jobId: string,
    videoPath: string,
    title: string
  ): Promise<UploadResult> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`[YouTubeAdapter] Video file not found: ${videoPath}`);
    }

    const yt = getYouTubeClient();
    const { youtube: ytConfig } = projectConfig;

    const shortsTitle = buildTitle(title);
    const description = buildDescription(title, ytConfig.descriptionTemplate);

    console.log(`[YouTubeAdapter] uploading "${shortsTitle}" (job: ${jobId})`);

    const response = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: shortsTitle,
          description,
          tags: ytConfig.tags,
          categoryId: ytConfig.categoryId,
        },
        status: {
          privacyStatus: ytConfig.privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        mimeType: "video/mp4",
        body: fs.createReadStream(videoPath),
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error(`[YouTubeAdapter] Upload succeeded but no videoId returned for job ${jobId}`);
    }

    console.log(`[YouTubeAdapter] uploaded — https://youtu.be/${videoId}`);

    return {
      externalId: videoId,
      url: `https://youtube.com/shorts/${videoId}`,
      platform: this.platform,
    };
  }

  async getStats(externalId: string): Promise<PlatformStats> {
    const yt = getYouTubeClient();

    try {
      const res = await yt.videos.list({
        part: ["statistics"],
        id: [externalId],
      });

      const stats = res.data.items?.[0]?.statistics;
      return {
        views: parseInt(stats?.viewCount ?? "0", 10),
        likes: parseInt(stats?.likeCount ?? "0", 10),
      };
    } catch (err) {
      console.error(`[YouTubeAdapter] getStats failed for ${externalId}:`, err);
      return { views: 0, likes: 0 };
    }
  }
}
