/**
 * Uploader worker
 *
 * Calls the appropriate PlatformAdapter based on the job's platform field.
 * The core pipeline never imports platform-specific code directly.
 */

import { getAdapter } from "@/lib/adapters";
import { connectDB, Job, Video } from "@/lib/db";

export async function uploadVideo(jobId: string): Promise<void> {
  await connectDB();

  const job = await Job.findById(jobId).lean();
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (!job.videoPath) {
    throw new Error(`Job ${jobId} has no videoPath set. Run video generation first.`);
  }

  const adapter = getAdapter(job.platform);
  const result = await adapter.upload(jobId, job.videoPath, job.title);

  await Video.create({
    jobId: job._id,
    title: job.title,
    platform: result.platform,
    externalId: result.externalId,
    publishedAt: new Date(),
  });

  await Job.findByIdAndUpdate(jobId, { status: "done" });
}
