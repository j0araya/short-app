/**
 * Uploader worker
 *
 * 1. Saves the video to Google Drive under /shorts/YYYY-MM-DD/
 * 2. Records the Video document in MongoDB with status "pending_publish"
 *    so the web dashboard can list it for review before publishing.
 *
 * YouTube / Instagram publish is intentionally deferred — triggered manually
 * from the /review/[id] dashboard page.
 * Drive upload failures are non-fatal — logged and stored as null.
 */

import { connectDB, Job, Video } from "@/lib/db";
import { uploadToDrive } from "@/lib/drive/upload";
import { generateCaption, generateHashtags } from "./caption-gen";

export async function uploadVideo(jobId: string): Promise<void> {
  await connectDB();

  const job = await Job.findById(jobId).lean();
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (!job.videoPath) {
    throw new Error(`Job ${jobId} has no videoPath set. Run video generation first.`);
  }

  const contentType = job.contentType ?? "short_video";

  // ── 1. Generate Instagram caption + hashtags ──────────────────────────────
  let instagramCaption: string | null = null;
  let instagramHashtags: string | null = null;

  if (contentType === "instagram_reel" || contentType === "instagram_post") {
    instagramCaption = generateCaption(
      job.title,
      0, // score not stored on Job; use 0 as default
      job.articleUrl ?? null
    );
    instagramHashtags = generateHashtags(job.title);
  }

  // ── 2. Upload to Google Drive ─────────────────────────────────────────────
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

  // ── 3. Persist Video record (pending_publish) ─────────────────────────────
  await Video.create({
    jobId: job._id,
    title: job.title,
    platform: job.platform,
    contentType,
    externalId: "",
    publishedAt: null,
    publishStatus: "pending_publish",
    sourceArticleUrl: job.articleUrl ?? null,
    hasVideo: job.hasVideo ?? false,
    instagramCaption,
    instagramHashtags,
    driveFileId,
    driveFolderId,
    driveWebViewLink,
  });

  await Job.findByIdAndUpdate(jobId, { status: "done" });
  console.log(`[uploader] Video saved — pending_publish (${contentType})`);
}
