import { NextRequest, NextResponse } from "next/server";
import { connectDB, Video } from "@/lib/db";

/**
 * GET /api/videos
 *
 * Returns videos saved to Drive, ordered by creation date desc.
 * Query params:
 *   ?status=pending_publish|published   (default: all)
 *   ?jobId=<jobId>                      filter by job ID
 *   ?limit=20                           (default: 20, max: 100)
 *   ?page=1
 */
export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  const jobId = searchParams.get("jobId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);

  const filter: Record<string, unknown> = {};
  if (status === "pending_publish" || status === "published") {
    filter.publishStatus = status;
  }
  if (jobId) {
    filter.jobId = jobId;
  }

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .populate("jobId", "title videoPath carouselPaths status contentType videoStyle")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Video.countDocuments(filter),
  ]);

  return NextResponse.json({
    videos,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
