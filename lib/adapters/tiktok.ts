/**
 * TikTokAdapter
 *
 * Publishes MP4 files to TikTok via the Content Posting API v2 (FILE_UPLOAD source).
 * Flow:
 *   1. Query creator info  → get privacy_level_options for this account
 *   2. Init upload         → receive publish_id + upload_url
 *   3. Chunked PUT upload  → PUT chunks to upload_url with Content-Range header
 *   4. Poll publish status → wait for PUBLISH_COMPLETE or FAILED
 *
 * Config (privacyLevel, disableComment, disableDuet, disableStitch) comes from
 * project.config.ts — nothing is hardcoded here.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY
 *   TIKTOK_CLIENT_SECRET
 *   TIKTOK_ACCESS_TOKEN
 *   TIKTOK_REFRESH_TOKEN
 *   TIKTOK_OPEN_ID
 */

import fs from "fs";
import { getTikTokToken } from "./tiktok-auth";
import { projectConfig } from "@/project.config";
import type { PlatformAdapter, PlatformStats, UploadResult } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "https://open.tiktokapis.com/v2";
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 40; // 40 × 3s = 2 min max

// ─── API response shapes ──────────────────────────────────────────────────────

interface TikTokApiEnvelope<T> {
  data: T;
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface CreatorInfoData {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

interface InitUploadData {
  publish_id: string;
  upload_url: string;
}

interface PublishStatusData {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
  fail_reason?: string;
  publicaly_available_post_id?: string[];
  uploaded_bytes?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertOk<T>(envelope: TikTokApiEnvelope<T>, context: string): T {
  if (envelope.error?.code && envelope.error.code !== "ok") {
    throw new Error(
      `[TikTokAdapter] ${context} API error (${envelope.error.code}): ${envelope.error.message}`
    );
  }
  return envelope.data;
}

async function tiktokPost<T>(
  path: string,
  accessToken: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[TikTokAdapter] POST ${path} failed (${res.status}): ${text}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── Step 1: creator info ─────────────────────────────────────────────────────

async function queryCreatorInfo(
  accessToken: string
): Promise<CreatorInfoData> {
  const envelope = await tiktokPost<TikTokApiEnvelope<CreatorInfoData>>(
    "/post/publish/creator_info/query/",
    accessToken,
    {}
  );
  return assertOk(envelope, "creator_info/query");
}

// ─── Step 2: init upload ──────────────────────────────────────────────────────

async function initUpload(
  accessToken: string,
  opts: {
    title: string;
    videoSize: number;
    chunkSize: number;
    totalChunkCount: number;
    privacyLevel: string;
    disableComment: boolean;
    disableDuet: boolean;
    disableStitch: boolean;
  }
): Promise<InitUploadData> {
  const envelope = await tiktokPost<TikTokApiEnvelope<InitUploadData>>(
    "/post/publish/video/init/",
    accessToken,
    {
      post_info: {
        title: opts.title.slice(0, 150), // TikTok title max 150 chars
        privacy_level: opts.privacyLevel,
        disable_comment: opts.disableComment,
        disable_duet: opts.disableDuet,
        disable_stitch: opts.disableStitch,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: opts.videoSize,
        chunk_size: opts.chunkSize,
        total_chunk_count: opts.totalChunkCount,
      },
    }
  );
  return assertOk(envelope, "video/init");
}

// ─── Step 3: chunked upload ───────────────────────────────────────────────────

async function uploadChunks(
  uploadUrl: string,
  videoPath: string,
  videoSize: number,
  chunkSize: number,
  totalChunks: number
): Promise<void> {
  const fileHandle = await fs.promises.open(videoPath, "r");

  try {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, videoSize) - 1;
      const length = end - start + 1;

      const buffer = Buffer.alloc(length);
      await fileHandle.read(buffer, 0, length, start);

      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${videoSize}`,
          "Content-Length": String(length),
        },
        body: buffer,
      });

      // TikTok returns 206 Partial Content for intermediate chunks, 201 for last
      if (!res.ok && res.status !== 206 && res.status !== 201) {
        const text = await res.text();
        throw new Error(
          `[TikTokAdapter] Chunk ${i + 1}/${totalChunks} upload failed (${res.status}): ${text}`
        );
      }

      console.log(
        `[TikTokAdapter] Chunk ${i + 1}/${totalChunks} uploaded (bytes ${start}-${end})`
      );
    }
  } finally {
    await fileHandle.close();
  }
}

// ─── Step 4: poll publish status ─────────────────────────────────────────────

async function pollPublishStatus(
  accessToken: string,
  publishId: string
): Promise<PublishStatusData> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const envelope = await tiktokPost<TikTokApiEnvelope<PublishStatusData>>(
      "/post/publish/status/fetch/",
      accessToken,
      { publish_id: publishId }
    );
    const data = assertOk(envelope, "status/fetch");

    console.log(
      `[TikTokAdapter] Publish status (attempt ${attempt + 1}): ${data.status}`
    );

    if (data.status === "PUBLISH_COMPLETE") return data;
    if (data.status === "FAILED") {
      throw new Error(
        `[TikTokAdapter] Publish failed: ${data.fail_reason ?? "unknown reason"}`
      );
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    `[TikTokAdapter] Publish timed out after ${POLL_MAX_ATTEMPTS} polling attempts`
  );
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = "tiktok";

  async upload(
    jobId: string,
    videoPath: string,
    title: string
  ): Promise<UploadResult> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`[TikTokAdapter] Video file not found: ${videoPath}`);
    }

    const { accessToken } = await getTikTokToken();
    const { tiktok: cfg } = projectConfig;

    const videoSize = fs.statSync(videoPath).size;
    const totalChunks = Math.ceil(videoSize / CHUNK_SIZE);

    console.log(
      `[TikTokAdapter] Starting upload for job ${jobId} — ` +
        `${(videoSize / 1024 / 1024).toFixed(1)} MB in ${totalChunks} chunk(s)`
    );

    // 1. Query creator info — validate privacy level is supported for this account
    const creatorInfo = await queryCreatorInfo(accessToken);
    const privacyLevel = cfg.privacyLevel;

    if (!creatorInfo.privacy_level_options.includes(privacyLevel)) {
      console.warn(
        `[TikTokAdapter] Requested privacy_level "${privacyLevel}" not available for this account. ` +
          `Available: ${creatorInfo.privacy_level_options.join(", ")}. ` +
          `Falling back to "${creatorInfo.privacy_level_options[0]}".`
      );
    }

    const resolvedPrivacyLevel = creatorInfo.privacy_level_options.includes(privacyLevel)
      ? privacyLevel
      : creatorInfo.privacy_level_options[0];

    // 2. Init upload
    const { publish_id, upload_url } = await initUpload(accessToken, {
      title,
      videoSize,
      chunkSize: CHUNK_SIZE,
      totalChunkCount: totalChunks,
      privacyLevel: resolvedPrivacyLevel,
      disableComment: cfg.disableComment,
      disableDuet: cfg.disableDuet,
      disableStitch: cfg.disableStitch,
    });

    console.log(`[TikTokAdapter] Upload initialized — publish_id: ${publish_id}`);

    // 3. Upload chunks
    await uploadChunks(upload_url, videoPath, videoSize, CHUNK_SIZE, totalChunks);

    console.log(`[TikTokAdapter] All chunks uploaded — polling for publish status…`);

    // 4. Poll until published
    const result = await pollPublishStatus(accessToken, publish_id);

    const postId = result.publicaly_available_post_id?.[0];
    const url = postId
      ? `https://www.tiktok.com/@${creatorInfo.creator_username}/video/${postId}`
      : `https://www.tiktok.com/@${creatorInfo.creator_username}`;

    console.log(`[TikTokAdapter] Published — ${url}`);

    return {
      externalId: publish_id,
      url,
      platform: this.platform,
    };
  }

  async getStats(externalId: string): Promise<PlatformStats> {
    // TikTok Display API requires video item IDs (not publish_ids).
    // The publish_id → item_id mapping is only available via the video.list endpoint
    // which needs user.info.stats scope. Returning zeroes gracefully until that
    // scope is approved in the developer portal.
    console.warn(
      `[TikTokAdapter] getStats not yet implemented for publish_id ${externalId}. ` +
        `Requires video.list scope approval.`
    );
    return { views: 0, likes: 0 };
  }
}
