import { NextRequest, NextResponse } from "next/server";
import { connectDB, Video } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import fs from "fs";

/**
 * POST /api/videos/[id]/publish
 *
 * Uploads the local MP4 to YouTube and marks the video as published.
 * The video must be in `pending_publish` status and the local file
 * must still exist at the path stored in the associated Job.
 *
 * Response:
 *   200 { externalId, url }
 *   400 Already published | video not found
 *   404 Video not found
 *   500 Upload failed
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await connectDB();

  const video = await Video.findById(id).populate("jobId");
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (video.publishStatus === "published") {
    return NextResponse.json(
      { error: "Video is already published", externalId: video.externalId },
      { status: 400 }
    );
  }

  // The populated jobId gives us access to the videoPath
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = video.jobId as any;
  const videoPath: string | null = job?.videoPath ?? null;

  if (!videoPath || !fs.existsSync(videoPath)) {
    return NextResponse.json(
      {
        error: "Local video file not found",
        path: videoPath,
        hint: "The MP4 may have been cleaned up from /tmp. Re-run the pipeline to regenerate.",
      },
      { status: 400 }
    );
  }

  try {
    const adapter = getAdapter(video.platform);
    const result = await adapter.upload(String(job._id), videoPath, video.title);

    video.externalId = result.externalId;
    video.publishStatus = "published";
    video.publishedAt = new Date();
    await video.save();

    return NextResponse.json({
      externalId: result.externalId,
      url: result.url,
      platform: result.platform,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[publish] Upload failed for video ${id}:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
