/**
 * POST /api/videos/:id/generate-for
 *
 * Creates a new Job (and enqueues generation) for a platform/contentType that
 * doesn't yet have a video, derived from an existing Video's source story.
 *
 * Body:
 *   { platform: "youtube" | "tiktok" | "instagram", contentType?: ContentType, videoStyle?: VideoStyle }
 *
 * Rules:
 *   - youtube  → contentType: short_video
 *   - tiktok   → contentType: short_video
 *   - instagram → contentType: instagram_post (default) | instagram_reel
 *
 * Returns: { jobId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB, Job, Video } from "@/lib/db";
import { pipelineQueue } from "@/lib/queue/client";
import { projectConfig } from "@/project.config";
import type { ContentType, VideoStyle } from "@/lib/db/models/Job";

const PLATFORM_DEFAULT_CONTENT_TYPE: Record<string, ContentType> = {
  youtube:   "short_video",
  tiktok:    "short_video",
  instagram: "instagram_post",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  // 1. Load the source video
  const video = await Video.findById(id).populate<{
    jobId: {
      _id: import("mongoose").Types.ObjectId;
      title: string;
      sourceUrl: string;
      articleUrl: string | null;
      hasVideo: boolean;
      thumbnail: string | null;
      score: number;
    };
  }>("jobId").lean();

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const sourceJob = video.jobId;
  if (!sourceJob) {
    return NextResponse.json({ error: "Source job not found" }, { status: 404 });
  }

  // 2. Parse request body
  const body = await req.json() as {
    platform: string;
    contentType?: ContentType;
    videoStyle?: VideoStyle;
  };

  const { platform, videoStyle = "narrative" } = body;
  const contentType: ContentType =
    body.contentType ?? PLATFORM_DEFAULT_CONTENT_TYPE[platform] ?? "short_video";

  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  // 3. Check if a Video already exists for this story + platform + contentType
  const existingVideo = await Video.findOne({
    jobId: sourceJob._id,
    platform,
    contentType,
  }).lean();

  if (existingVideo) {
    return NextResponse.json(
      { error: "A video already exists for this platform/contentType", videoId: String(existingVideo._id) },
      { status: 409 }
    );
  }

  // 4. Check if a Job already exists for this story + platform + contentType
  //    (could be in-flight or done without a video doc yet)
  const existingJob = await Job.findOne({
    sourceUrl: sourceJob.sourceUrl,
    platform,
    contentType,
  }).lean();

  if (existingJob && existingJob.status !== "failed") {
    return NextResponse.json(
      { error: "A job is already in progress for this platform/contentType", jobId: String(existingJob._id) },
      { status: 409 }
    );
  }

  // 5. Create new Job — same story, different platform/contentType.
  //    Use upsert so a previously-failed job gets reset instead of causing a duplicate key error.
  const newJob = await Job.findOneAndUpdate(
    {
      sourceUrl:   sourceJob.sourceUrl,
      platform,
      contentType,
    },
    {
      $set: {
        title:      sourceJob.title,
        articleUrl: sourceJob.articleUrl,
        hasVideo:   sourceJob.hasVideo,
        thumbnail:  sourceJob.thumbnail,
        score:      sourceJob.score,
        niche:      projectConfig.niche,
        videoStyle,
        status:     "pending",
        errorMsg:   null,
        videoPath:  null,
      },
      $setOnInsert: {
        sourceUrl:   sourceJob.sourceUrl,
        platform,
        contentType,
      },
    },
    { upsert: true, new: true }
  );

  // 6. Enqueue generation
  await pipelineQueue.add(
    "generate:single",
    { jobId: String(newJob._id) },
    { jobId: `generate-${String(newJob._id)}-${Date.now()}` }
  );

  return NextResponse.json({ jobId: String(newJob._id) }, { status: 201 });
}
