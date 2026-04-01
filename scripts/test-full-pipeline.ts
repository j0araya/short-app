/**
 * scripts/test-full-pipeline.ts
 *
 * End-to-end test: takes a candidate from MongoDB (no video, no subtitles),
 * generates the slideshow video, generates an AI caption via Ollama,
 * uploads to Drive, and publishes to YouTube Shorts with the AI description.
 *
 * Usage: npx tsx scripts/test-full-pipeline.ts [candidateId]
 *   If no candidateId is given, picks the highest-score new candidate.
 */

import "dotenv/config";
import { connectDB, Candidate, Job, Video } from "../lib/db";
import { generateVideo } from "../lib/workers/video-gen";
import { generateAICaption } from "../lib/workers/ai-caption";
import { generateYouTubeHashtags, generateYouTubeDescription } from "../lib/workers/caption-gen";
import { uploadToDrive } from "../lib/drive/upload";
import { YouTubeAdapter } from "../lib/adapters/youtube";
import { projectConfig } from "../project.config";

async function main() {
  await connectDB();

  // ── 1. Pick candidate ──────────────────────────────────────────────────────
  const candidateId = process.argv[2] ?? null;

  const candidate = candidateId
    ? await Candidate.findById(candidateId).lean()
    : await Candidate.findOne({ status: "new", hasVideo: false }).sort({ score: -1 }).lean();

  if (!candidate) {
    console.error("No candidate found. Run scrape first.");
    process.exit(1);
  }

  console.log("\n=== test-full-pipeline ===\n");
  console.log(`Candidate : ${candidate.title}`);
  console.log(`Score     : ${candidate.score}`);
  console.log(`hasVideo  : ${candidate.hasVideo}`);
  console.log(`articleUrl: ${candidate.articleUrl ?? "(none)"}\n`);

  // ── 2. Generate video ──────────────────────────────────────────────────────
  const jobId = `test-${Date.now()}`;
  console.log(`[1/4] Generating video (jobId: ${jobId})...`);

  const { videoPath, durationSeconds } = await generateVideo(
    jobId,
    candidate.title,
    candidate.articleUrl,
    candidate.score,
    false, // force no-subtitle path to test slideshow
    "short_video"
  );

  console.log(`  videoPath : ${videoPath}`);
  console.log(`  duration  : ${durationSeconds}s\n`);

  // ── 3. AI caption ──────────────────────────────────────────────────────────
  console.log(`[2/4] Generating AI caption via Ollama...`);

  const aiResult = await generateAICaption(candidate.title, candidate.articleUrl);

  const description = aiResult?.description ?? generateYouTubeDescription(candidate.title);
  const hashtags = generateYouTubeHashtags(candidate.title);

  console.log(`  tone      : ${aiResult?.tone ?? "fallback"}`);
  console.log(`\n  Description:\n${description.split("\n").map(l => "  " + l).join("\n")}`);
  console.log(`\n  Hashtags  : ${hashtags}\n`);

  // ── 4. Upload to Drive ─────────────────────────────────────────────────────
  console.log(`[3/4] Uploading to Google Drive...`);

  let driveLink = "(skipped)";
  try {
    const driveResult = await uploadToDrive(videoPath!, "youtube", candidate.title);
    driveLink = driveResult.webViewLink;
    console.log(`  Drive     : ${driveLink}\n`);
  } catch (err) {
    console.warn(`  Drive upload failed (non-fatal): ${err instanceof Error ? err.message : err}\n`);
  }

  // ── 5. Publish to YouTube Shorts ──────────────────────────────────────────
  console.log(`[4/4] Publishing to YouTube Shorts...`);

  const adapter = new YouTubeAdapter();
  const result = await adapter.upload(jobId, videoPath!, candidate.title, {
    description,
    hashtags,
  });

  console.log(`\n✓ Published!`);
  console.log(`  YouTube URL : ${result.url}`);
  console.log(`  Video ID    : ${result.externalId}`);
  console.log(`  Drive link  : ${driveLink}`);

  // ── 6. Persist records in MongoDB ─────────────────────────────────────────
  await Candidate.findByIdAndUpdate(candidate._id, { status: "selected", selectedAt: new Date() });

  const dbJob = await Job.create({
    title: candidate.title,
    sourceUrl: candidate.sourceUrl,
    articleUrl: candidate.articleUrl,
    hasVideo: false,
    thumbnail: candidate.ogImageUrl,
    score: candidate.score,
    niche: projectConfig.niche,
    platform: "youtube",
    contentType: "short_video",
    status: "done",
    videoPath,
  });

  await Video.create({
    jobId: dbJob._id,
    title: candidate.title,
    platform: "youtube",
    contentType: "short_video",
    externalId: result.externalId,
    publishedAt: new Date(),
    publishStatus: "published",
    sourceArticleUrl: candidate.articleUrl ?? null,
    hasVideo: false,
    youtubeDescription: description,
    youtubeHashtags: hashtags,
    driveWebViewLink: driveLink !== "(skipped)" ? driveLink : null,
  });

  console.log(`\n  MongoDB records saved (Job + Video).`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
