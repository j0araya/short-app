/**
 * GET /api/logs
 *
 * Query pipeline logs from MongoDB.
 *
 * Query params:
 *   jobId   — filter by job (required unless fetching recent cross-job logs)
 *   level   — "info" | "warn" | "error" (optional, comma-separated for multi)
 *   step    — "scrape" | "generate" | "upload" | "publish" | "caption" | "worker" (optional)
 *   limit   — max results (default 200, max 500)
 *   since   — ISO date string — only logs after this timestamp (for polling)
 *
 * Returns: { logs: IPipelineLog[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB, PipelineLog } from "@/lib/db";
import type { PipelineLogLevel, PipelineLogStep } from "@/lib/db/models/PipelineLog";

const VALID_LEVELS = new Set<string>(["info", "warn", "error"]);
const VALID_STEPS = new Set<string>(["scrape", "generate", "upload", "publish", "caption", "worker"]);
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = req.nextUrl;

  const jobId = searchParams.get("jobId");
  const levelParam = searchParams.get("level");
  const stepParam = searchParams.get("step");
  const limitParam = searchParams.get("limit");
  const since = searchParams.get("since");

  // Build query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};

  if (jobId) {
    query.jobId = jobId;
  }

  if (levelParam) {
    const levels = levelParam.split(",").filter((l) => VALID_LEVELS.has(l)) as PipelineLogLevel[];
    if (levels.length === 1) {
      query.level = levels[0];
    } else if (levels.length > 1) {
      query.level = { $in: levels };
    }
  }

  if (stepParam) {
    const steps = stepParam.split(",").filter((s) => VALID_STEPS.has(s)) as PipelineLogStep[];
    if (steps.length === 1) {
      query.step = steps[0];
    } else if (steps.length > 1) {
      query.step = { $in: steps };
    }
  }

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      query.createdAt = { $gt: sinceDate };
    }
  }

  const limit = Math.min(
    parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  try {
    const logs = await PipelineLog.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ logs });
  } catch (err) {
    console.error("[/api/logs] error:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
