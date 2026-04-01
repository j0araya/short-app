/**
 * scripts/publish-to-youtube.ts
 *
 * End-to-end: scrape one HN story → generate slideshow video → publish to YouTube Shorts.
 * Does NOT require Redis/BullMQ or MongoDB — runs fully standalone.
 *
 * Run: npx tsx --env-file=.env scripts/publish-to-youtube.ts
 */

import "dotenv/config";
import { scrapeHN } from "../lib/workers/scraper-hn";
import { generateVideo } from "../lib/workers/video-gen";
import { YouTubeAdapter } from "../lib/adapters/youtube";

async function main() {
  console.log("=== publish-to-youtube ===\n");

  // 1. Scrape one HN story
  console.log("[1/3] Fetching from Hacker News...");
  const posts = await scrapeHN();

  if (posts.length === 0) {
    console.error("No posts found — HN API may be down or all stories already processed.");
    process.exit(1);
  }

  const post = posts[0];
  console.log(`  title:  ${post.title}`);
  console.log(`  url:    ${post.url}`);
  console.log(`  score:  ${post.score}\n`);

  // 2. Generate video
  const jobId = `yt-${Date.now()}`;
  console.log(`[2/3] Generating video (jobId: ${jobId})...`);
  const { videoPath, durationSeconds } = await generateVideo(
    jobId,
    post.title,
    post.articleUrl,
    post.score,
    post.hasVideo,
    "short_video"
  );
  console.log(`  videoPath: ${videoPath}`);
  console.log(`  duration:  ${durationSeconds}s\n`);

  // 3. Upload to YouTube Shorts
  console.log("[3/3] Uploading to YouTube Shorts...");
  const adapter = new YouTubeAdapter();
  const result = await adapter.upload(jobId, videoPath!, post.title);

  console.log(`\n✓ Published!`);
  console.log(`  YouTube URL: ${result.url}`);
  console.log(`  Video ID:    ${result.externalId}`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message ?? err);
  process.exit(1);
});
