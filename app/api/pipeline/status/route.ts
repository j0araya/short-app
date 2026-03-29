import { NextResponse } from "next/server";
import { pipelineQueue } from "@/lib/queue/client";

export async function GET() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      pipelineQueue.getWaitingCount(),
      pipelineQueue.getActiveCount(),
      pipelineQueue.getCompletedCount(),
      pipelineQueue.getFailedCount(),
    ]);

    return NextResponse.json({
      queued: waiting,
      processing: active,
      done: completed,
      failed,
    });
  } catch (err) {
    console.error("[/api/pipeline/status] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch queue status. Is Redis running?" },
      { status: 503 }
    );
  }
}
