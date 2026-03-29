/**
 * Uploader worker
 *
 * 1. Calls the appropriate PlatformAdapter (YouTube, TikTok, etc.)
 * 2. Saves the video to Google Drive under /shorts/YYYY-MM-DD/
 * 3. Records the Video document in MongoDB with Drive metadata
 *
 * The core pipeline never imports platform-specific code directly.
 * Drive upload failures are non-fatal — logged and stored as null.
 */

import { getAdapter } from "@/lib/adapters";
import { connectDB, Job, Video } from "@/lib/db";
import { uploadToDrive } from "@/lib/drive/upload";

export async function uploadVideo(jobId: string): Promise<void> {
  await connectDB();

  const job = await Job.findById(jobId).lean();
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (!job.videoPath) {
    throw new Error(`Job ${jobId} has no videoPath set. Run video generation first.`);
  }

  // ── 1. Upload to platform (YouTube, etc.) ────────────────────────────────
  const adapter = getAdapter(job.platform);
  const result = await adapter.upload(jobId, job.videoPath, job.title);

  // ── 2. Upload to Google Drive (non-fatal) ────────────────────────────────
  let driveFileId: string | null = null;
  let driveFolderId: string | null = null;
  let driveWebViewLink: string | null = null;

  try {
    const driveResult = await uploadToDrive(job.videoPath, job.platform, job.title);
    driveFileId = driveResult.fileId;
    driveFolderId = driveResult.folderId;
    driveWebViewLink = driveResult.webViewLink;
    console.log(`[uploader] Drive upload OK — ${driveResult.webViewLink}`);
  } catch (err) {
    console.error(`[uploader] Drive upload failed for job ${jobId} (non-fatal):`, err);
  }

  // ── 3. Persist Video record ──────────────────────────────────────────────
  await Video.create({
    jobId: job._id,
    title: job.title,
    platform: result.platform,
    externalId: result.externalId,
    publishedAt: new Date(),
    driveFileId,
    driveFolderId,
    driveWebViewLink,
  });

  await Job.findByIdAndUpdate(jobId, { status: "done" });
}
