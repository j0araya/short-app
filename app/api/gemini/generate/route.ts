/**
 * POST /api/gemini/generate
 *
 * Generates a short video with Veo 2 from a text prompt, uploads it to
 * Google Drive, and creates a Video document (pending_publish) so it
 * appears in the review page.
 *
 * Body: { prompt: string; title?: string }
 *
 * Response: { videoId: string; driveWebViewLink: string }
 */

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { connectDB, Video, ActivityEvent } from "@/lib/db";
import { uploadToDrive } from "@/lib/drive/upload";
import { generateVideoWithVeo } from "@/lib/workers/comment-pipeline";

const TMP_DIR = "/tmp/short-app/gemini-gen";

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt?: string; title?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const title = body.title?.trim() || "Gemini Veo Generation";

    await connectDB();
    ensureTmpDir();

    // 1. Generate video with Veo 2
    const outputPath = path.join(TMP_DIR, `gemini-${Date.now()}.mp4`);
    await generateVideoWithVeo(prompt, outputPath);

    // 2. Upload to Drive under gemini platform folder
    const driveResult = await uploadToDrive(outputPath, "gemini", title);

    // 3. Create Video document
    const video = await Video.create({
      // Veo-generated videos have no Job — use a fresh ObjectId as placeholder
      jobId:           new (await import("mongoose")).default.Types.ObjectId(),
      title,
      platform:        "gemini",
      contentType:     "short_video",
      publishStatus:   "pending_publish",
      sourceArticleUrl: null,
      hasVideo:        true,
      youtubeDescription: title,
      youtubeHashtags:    "#Shorts #AI #Gemini",
      driveFileId:     driveResult.fileId,
      driveFolderId:   driveResult.folderId,
      driveWebViewLink: driveResult.webViewLink,
    });

    // 4. Emit activity event
    try {
      await ActivityEvent.create({
        type:     "video_ready",
        title,
        platform: "gemini",
        videoId:  video._id,
      });
    } catch { /* non-fatal */ }

    // 5. Clean up tmp file
    try { fs.unlinkSync(outputPath); } catch { /* non-fatal */ }

    return NextResponse.json({
      videoId:         String(video._id),
      driveWebViewLink: driveResult.webViewLink,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gemini/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
