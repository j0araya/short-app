/**
 * POST /api/pipeline/comments/trigger
 *
 * Manually triggers the comment-driven generation pipeline.
 * Enqueues a one-shot `comments:generate` BullMQ job.
 *
 * Optional body: { videoId: string }
 *   - If provided, runs only for that specific YouTube video ID.
 *   - If omitted, runs for ALL published YouTube videos.
 *
 * Returns: { jobId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { pipelineQueue } from "@/lib/queue/client";

export async function POST(req: NextRequest) {
  try {
    let videoId: string | undefined;

    try {
      const body = await req.json() as { videoId?: string };
      videoId = body.videoId;
    } catch {
      // Body is optional — ignore parse errors
    }

    const jobName = "comments:generate";
    const jobData = videoId ? { videoId } : {};
    const jobId   = videoId
      ? `comments-${videoId}-${Date.now()}`
      : `comments-all-${Date.now()}`;

    const job = await pipelineQueue.add(jobName, jobData, { jobId });

    return NextResponse.json(
      { jobId: job.id, mode: videoId ? "single" : "all", videoId: videoId ?? null },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/pipeline/comments/trigger] Error:", err);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
