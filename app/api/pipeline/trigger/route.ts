import { NextResponse } from "next/server";
import { pipelineQueue } from "@/lib/queue/client";

export async function POST() {
  try {
    const job = await pipelineQueue.add("pipeline:run", {
      triggeredAt: new Date().toISOString(),
    });

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (err) {
    console.error("[/api/pipeline/trigger] error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue pipeline job. Is Redis running?" },
      { status: 503 }
    );
  }
}
