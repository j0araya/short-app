import { NextRequest, NextResponse } from "next/server";
import { connectDB, Video } from "@/lib/db";

/**
 * GET /api/videos/[id]
 * Returns a single video with its populated Job.
 *
 * PATCH /api/videos/[id]
 * Updates caption / hashtags before publishing.
 * Body: { instagramCaption?, instagramHashtags? }
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  const video = await Video.findById(id).populate("jobId").lean();
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  const body = await req.json() as {
    instagramCaption?: string;
    instagramHashtags?: string;
    youtubeDescription?: string;
    youtubeHashtags?: string;
    tiktokDescription?: string;
    tiktokHashtags?: string;
  };

  const ALLOWED = [
    "instagramCaption",
    "instagramHashtags",
    "youtubeDescription",
    "youtubeHashtags",
    "tiktokDescription",
    "tiktokHashtags",
  ] as const;

  const update: Record<string, string> = {};
  for (const key of ALLOWED) {
    if (typeof body[key] === "string") {
      update[key] = body[key] as string;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const video = await Video.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}
