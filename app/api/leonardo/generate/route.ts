/**
 * POST /api/leonardo/generate
 *
 * Starts a Leonardo.ai text-to-video generation (Motion 2.0, 9:16).
 * Registers a webhook so Leonardo calls back /api/leonardo/webhook when done.
 *
 * Body: { prompt: string; title?: string }
 *
 * Response: { generationId: string; webhookUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB, ActivityEvent, Video } from "@/lib/db";
import { startTextToVideo } from "@/lib/adapters/leonardo";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt?: string; title?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const title = body.title?.trim() || "Leonardo AI Short";

    // Build the webhook callback URL from the public app URL
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not set — required for webhook callback" },
        { status: 500 }
      );
    }
    const webhookUrl = `${appUrl}/api/leonardo/webhook`;

    await connectDB();

    // Create a placeholder Video doc so we can link the webhook callback to it
    const video = await Video.create({
      jobId:           new mongoose.Types.ObjectId(),
      title,
      platform:        "leonardo",
      contentType:     "short_video",
      publishStatus:   "generating",
      sourceArticleUrl: null,
      hasVideo:        false,
      youtubeDescription: title,
      youtubeHashtags:    "#Shorts #AI #Leonardo",
    });

     // Start the generation — Leonardo will POST to webhookUrl when done
     // (webhook is configured globally on the API key)
     const generationId = await startTextToVideo({
       prompt,
       width:              480,
       height:             832,
       resolution:         "RESOLUTION_720",
       frameInterpolation: true,
       promptEnhance:      true,
     });

    // Store the generationId on the video so the webhook can find it
    await Video.findByIdAndUpdate(video._id, {
      externalId: generationId, // reuse externalId field as generationId store
    });

    // Emit activity event
    try {
      await ActivityEvent.create({
        type:     "video_generating",
        title,
        platform: "leonardo",
        videoId:  video._id,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      generationId,
      videoId:    String(video._id),
      webhookUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[leonardo/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
