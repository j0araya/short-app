/**
 * Uploader worker
 *
 * Calls the appropriate PlatformAdapter based on the job's platform field.
 * The core pipeline never imports platform-specific code directly.
 */

import { getAdapter } from "@/lib/adapters";
import { prisma } from "@/lib/db/prisma";

export async function uploadVideo(jobId: string): Promise<void> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });

  if (!job.videoPath) {
    throw new Error(`Job ${jobId} has no videoPath set. Run video generation first.`);
  }

  const adapter = getAdapter(job.platform);
  const result = await adapter.upload(jobId, job.videoPath, job.title);

  await prisma.video.create({
    data: {
      jobId,
      title: job.title,
      platform: result.platform,
      externalId: result.externalId,
      publishedAt: new Date(),
    },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "done" },
  });
}
