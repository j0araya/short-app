/**
 * POST /api/leonardo/webhook
 *
 * Receives the Leonardo.ai callback when a video generation completes.
 *
 * Leonardo sends a POST with JSON body:
 * {
 *   "type": "video_generation.complete",
 *   "data": {
 *     "object": {
 *       "id": "<generationId>",
 *       "status": "COMPLETE" | "FAILED",
 *       "videoUrl": "https://...",       // sometimes
 *       "videos": [{ "url": "..." }],    // sometimes
 *       "generated_videos": [{ "url": "..." }] // sometimes
 *     }
 *   }
 * }
 *
 * On COMPLETE:
 *   1. Find the Video doc by externalId = generationId
 *   2. Download the video to /tmp
 *   3. Upload to Google Drive
 *   4. Update Video doc (hasVideo, driveFileId, publishStatus = pending_publish)
 *   5. Emit video_ready ActivityEvent
 */

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { connectDB, Video, ActivityEvent } from "@/lib/db";
import {
  extractVideoUrlFromWebhook,
  downloadVideo,
  type LeonardoWebhookPayload,
} from "@/lib/adapters/leonardo";
import { uploadToDrive } from "@/lib/drive/upload";

const TMP_DIR = "/tmp/short-app/leonardo-webhook";

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  let generationId = "<unknown>";
  try {
    const payload = await req.json() as LeonardoWebhookPayload;

    generationId = payload.data?.object?.id ?? "<unknown>";
    const status   = payload.data?.object?.status;

    console.log(`[leonardo/webhook] Received type=${payload.type} id=${generationId} status=${status}`);

    // Always respond 200 fast — Leonardo will retry on non-2xx
    if (status !== "COMPLETE") {
      console.warn(`[leonardo/webhook] Generation ${generationId} is ${status}, skipping`);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const videoUrl = extractVideoUrlFromWebhook(payload);
    if (!videoUrl) {
      console.error(`[leonardo/webhook] COMPLETE but no videoUrl for ${generationId}`);
      return NextResponse.json({ ok: true, skipped: true });
    }

    await connectDB();

    // Find the placeholder Video doc created in /api/leonardo/generate
    const video = await Video.findOne({ externalId: generationId });
    if (!video) {
      console.error(`[leonardo/webhook] No Video doc found for generationId=${generationId}`);
      return NextResponse.json({ ok: true, skipped: true });
    }

    ensureTmpDir();
    const outputPath = path.join(TMP_DIR, `${generationId}.mp4`);

    // Download video
    await downloadVideo(videoUrl, outputPath);

    // Upload to Drive
    const driveResult = await uploadToDrive(outputPath, "leonardo", video.title ?? "Leonardo Short");

    // Update Video doc
    await Video.findByIdAndUpdate(video._id, {
      hasVideo:        true,
      publishStatus:   "pending_publish",
      driveFileId:     driveResult.fileId,
      driveFolderId:   driveResult.folderId,
      driveWebViewLink: driveResult.webViewLink,
    });

    // Emit activity event
    try {
      await ActivityEvent.create({
        type:     "video_ready",
        title:    video.title ?? "Leonardo Short",
        platform: "leonardo",
        videoId:  video._id,
      });
    } catch { /* non-fatal */ }

    // Cleanup
    try { fs.unlinkSync(outputPath); } catch { /* non-fatal */ }

    console.log(`[leonardo/webhook] Done for ${generationId} → Drive: ${driveResult.webViewLink}`);
    return NextResponse.json({ ok: true, videoId: String(video._id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[leonardo/webhook] Error for ${generationId}:`, message);
    // Still return 200 — Leonardo retries on 5xx which would create duplicates
    return NextResponse.json({ ok: false, error: message });
  }
}
