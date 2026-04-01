/**
 * POST /api/jobs/[id]/retry
 *
 * Resets a failed (or stuck) job back to "pending" and re-enqueues
 * a "generate:single" BullMQ task so the worker picks it up again.
 *
 * Only allowed for jobs with status "failed". Returns 409 if the job
 * is already pending/processing (no-op would be confusing).
 *
 * On retry:
 *  - status → "pending"
 *  - errorMsg → cleared
 *  - videoPath / carouselPaths → cleared (will be regenerated)
 *  - A new BullMQ job is enqueued (unique jobId prevents duplicates)
 */

import { NextResponse } from "next/server";
import { connectDB, Job } from "@/lib/db";
import { pipelineQueue } from "@/lib/queue/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await connectDB();

  const job = await Job.findById(id).lean();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "pending" || job.status === "processing") {
    return NextResponse.json(
      { error: `Job is already ${job.status} — no retry needed` },
      { status: 409 }
    );
  }

  // Reset job state
  await Job.findByIdAndUpdate(id, {
    status: "pending",
    errorMsg: null,
    videoPath: null,
    carouselPaths: null,
  });

  // Re-enqueue — use a timestamped jobId so BullMQ doesn't deduplicate with the original
  await pipelineQueue.add(
    "generate:single",
    { jobId: id },
    { jobId: `generate-${id}-retry-${Date.now()}` }
  );

  return NextResponse.json({ success: true, jobId: id }, { status: 200 });
}
