/**
 * Uploader worker
 *
 * 1. Generates AI-powered descriptions (Ollama local) with rule-based fallback.
 * 2. Generates hashtags (rule-based).
 * 3. Saves the asset to Google Drive under /shorts/YYYY-MM-DD/:
 *    - short_video / instagram_reel: uploads the MP4.
 *    - instagram_post (carousel): uploads each PNG tile individually.
 *      driveWebViewLink → Drive folder link (shows all tiles).
 *      driveFileId → first tile's file ID.
 * 4. Records the Video document in MongoDB with status "pending_publish"
 *    so the web dashboard can list it for review before publishing.
 *
 * YouTube / Instagram publish is intentionally deferred — triggered manually
 * from the /review/[id] dashboard page.
 * Drive upload failures are non-fatal — logged and stored as null.
 */

import { connectDB, Job, Video, ActivityEvent } from "@/lib/db";
import { uploadToDrive } from "@/lib/drive/upload";
import { generateAICaption } from "./ai-caption";
import { pLog } from "./pipelineLogger";
import {
  generateInstagramCaption,
  generateInstagramHashtags,
  generateYouTubeDescription,
  generateYouTubeHashtags,
  generateTikTokDescription,
  generateTikTokHashtags,
} from "./caption-gen";

export async function uploadVideo(jobId: string): Promise<void> {
  await connectDB();

  const job = await Job.findById(jobId).lean();
  if (!job) throw new Error(`Job ${jobId} not found`);

  const contentType = job.contentType ?? "short_video";
  const articleUrl = job.articleUrl ?? null;
  const isCarousel = contentType === "instagram_post";

  // Guard: need either a videoPath (MP4) or carouselPaths (PNGs)
  if (!isCarousel && !job.videoPath) {
    throw new Error(`Job ${jobId} has no videoPath set. Run video generation first.`);
  }
  if (isCarousel && (!job.carouselPaths || job.carouselPaths.length === 0)) {
    throw new Error(`Job ${jobId} has no carouselPaths set. Run video generation first.`);
  }

  // ── 1. AI description ─────────────────────────────────────────────────────
  console.log(`[uploader] generating AI caption for "${job.title}"`);
  await pLog(jobId, "caption", "info", `Generating AI caption for "${job.title}"`);
  const captionStart = Date.now();
  const aiResult = await generateAICaption(job.title, articleUrl);

  if (aiResult) {
    console.log(`[uploader] AI caption OK (tone: ${aiResult.tone})`);
    await pLog(jobId, "caption", "info", `AI caption OK (tone: ${aiResult.tone})`, { durationMs: Date.now() - captionStart });
  } else {
    console.log(`[uploader] AI caption failed — using rule-based fallback`);
    await pLog(jobId, "caption", "warn", `AI caption failed — using rule-based fallback`, { durationMs: Date.now() - captionStart });
  }

  // ── 2. Build per-platform descriptions + hashtags ─────────────────────────
  let instagramCaption: string | null = null;
  let instagramHashtags: string | null = null;
  let youtubeDescription: string | null = null;
  let youtubeHashtags: string | null = null;
  let tiktokDescription: string | null = null;
  let tiktokHashtags: string | null = null;

  if (job.platform === "youtube" || contentType === "short_video") {
    youtubeDescription = aiResult?.description ?? generateYouTubeDescription(job.title);
    youtubeHashtags = generateYouTubeHashtags(job.title);
  }

  if (job.platform === "tiktok") {
    tiktokDescription = aiResult?.description ?? generateTikTokDescription(job.title);
    tiktokHashtags = generateTikTokHashtags(job.title);
  }

  if (
    contentType === "instagram_reel" ||
    contentType === "instagram_post" ||
    job.platform === "instagram"
  ) {
    instagramCaption = aiResult?.description ?? generateInstagramCaption(job.title);
    instagramHashtags = generateInstagramHashtags(job.title);
  }

  // ── 3. Upload to Google Drive ─────────────────────────────────────────────
  let driveFileId: string | null = null;
  let driveFolderId: string | null = null;
  let driveWebViewLink: string | null = null;

  try {
    if (isCarousel && job.carouselPaths && job.carouselPaths.length > 0) {
      // Upload each PNG tile individually — no ZIP needed.
      // All tiles land in the same daily folder.
      // driveWebViewLink → folder link so the reviewer can see all tiles at once.
      console.log(`[uploader] uploading ${job.carouselPaths.length} carousel tiles to Drive`);
      await pLog(jobId, "upload", "info", `Uploading ${job.carouselPaths.length} carousel tiles to Drive`);

      for (let i = 0; i < job.carouselPaths.length; i++) {
        const tilePath = job.carouselPaths[i];
        // Append slide index to title so filenames are distinct
        const tileTitle = `${job.title} — slide ${i + 1}`;
        const result = await uploadToDrive(tilePath, job.platform, tileTitle);

        // Capture first tile's fileId; all tiles share the same folderId
        if (i === 0) driveFileId = result.fileId;
        driveFolderId = result.folderId;
        console.log(`[uploader] tile ${i + 1}/${job.carouselPaths.length} uploaded`);
        await pLog(jobId, "upload", "info", `Tile ${i + 1}/${job.carouselPaths.length} uploaded to Drive`);
      }

      // Link to the Drive folder (shows the full carousel)
      driveWebViewLink = driveFolderId
        ? `https://drive.google.com/drive/folders/${driveFolderId}`
        : null;

      console.log(`[uploader] Drive carousel upload OK — ${driveWebViewLink}`);
      await pLog(jobId, "upload", "info", `Drive carousel upload complete — ${driveWebViewLink}`);
    } else if (job.videoPath) {
      const driveResult = await uploadToDrive(job.videoPath, job.platform, job.title);
      driveFileId = driveResult.fileId;
      driveFolderId = driveResult.folderId;
      driveWebViewLink = driveResult.webViewLink;
      console.log(`[uploader] Drive upload OK — ${driveResult.webViewLink}`);
      await pLog(jobId, "upload", "info", `Drive upload complete — ${driveResult.webViewLink}`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[uploader] Drive upload failed for job ${jobId} (non-fatal):`, err);
    await pLog(jobId, "upload", "error", `Drive upload failed (non-fatal): ${errMsg}`);
  }

  // ── 4. Persist Video record (pending_publish) ─────────────────────────────
  await Video.create({
    jobId: job._id,
    title: job.title,
    platform: job.platform,
    contentType,
    externalId: "",
    publishedAt: null,
    publishStatus: "pending_publish",
    sourceArticleUrl: articleUrl,
    hasVideo: job.hasVideo ?? false,
    instagramCaption,
    instagramHashtags,
    youtubeDescription,
    youtubeHashtags,
    tiktokDescription,
    tiktokHashtags,
    driveFileId,
    driveFolderId,
    driveWebViewLink,
  });

  await Job.findByIdAndUpdate(jobId, { status: "done" });
  console.log(`[uploader] Video saved — pending_publish (${contentType}, platform: ${job.platform})`);
  await pLog(jobId, "upload", "info", `Job done — Video saved as pending_publish (${contentType}, platform: ${job.platform})`);

  // Emit activity event — video is ready for review
  try {
    await ActivityEvent.create({
      type: "video_ready",
      title: job.title,
      platform: job.platform,
      jobId: job._id,
    });
  } catch {
    // Non-fatal — don't block the pipeline
  }
}
