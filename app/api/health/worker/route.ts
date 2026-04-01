/**
 * GET /api/health/worker
 *
 * Returns whether the BullMQ worker process is alive by checking a heartbeat
 * key the worker refreshes in Redis every 20s (TTL 60s).
 * Also returns queue depth for pending + active jobs.
 */

import { NextResponse } from "next/server";
import { redisConnection, pipelineQueue } from "@/lib/queue/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [heartbeat, waiting, active] = await Promise.all([
      redisConnection.get("worker:heartbeat"),
      pipelineQueue.getWaitingCount(),
      pipelineQueue.getActiveCount(),
    ]);

    return NextResponse.json({
      alive: heartbeat !== null,
      lastSeen: heartbeat ? new Date(Number(heartbeat)).toISOString() : null,
      pendingJobs: waiting + active,
    });
  } catch (err) {
    return NextResponse.json(
      { alive: false, lastSeen: null, pendingJobs: 0, error: String(err) },
      { status: 503 }
    );
  }
}
