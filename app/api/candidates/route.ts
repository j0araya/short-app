import { NextRequest, NextResponse } from "next/server";
import { connectDB, Candidate } from "@/lib/db";

/**
 * GET /api/candidates
 *
 * Returns scraped HN posts available for selection.
 * Query params:
 *   ?status=new|selected|skipped  (default: new)
 *   ?limit=50                     (default: 50, max: 200)
 *   ?page=1
 */
export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "new";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);

  const filter: Record<string, unknown> = {};
  if (["new", "selected", "skipped"].includes(status)) {
    filter.status = status;
  }

  const [candidates, total] = await Promise.all([
    Candidate.find(filter)
      .sort({ score: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Candidate.countDocuments(filter),
  ]);

  return NextResponse.json({
    candidates,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
