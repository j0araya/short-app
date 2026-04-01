import { NextRequest, NextResponse } from "next/server";
import { connectDB, ActivityEvent } from "@/lib/db";

/**
 * GET /api/activity
 *
 * Returns the most recent pipeline activity events for the sidebar feed.
 *
 * Query params:
 *   ?limit=20   — max events to return (default 20, max 50)
 *   ?after=<iso> — only events created after this ISO timestamp (for polling)
 */
export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const after = searchParams.get("after");

  const filter: Record<string, unknown> = {};
  if (after) {
    const date = new Date(after);
    if (!isNaN(date.getTime())) {
      filter.createdAt = { $gt: date };
    }
  }

  const events = await ActivityEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ events });
}
