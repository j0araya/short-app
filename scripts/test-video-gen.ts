/**
 * scripts/test-video-gen.ts
 *
 * Standalone test: fetch one HN story and generate a video locally.
 * Does NOT require Redis/BullMQ or ElevenLabs — no audio, image slideshow only.
 *
 * Run: npx tsx --env-file=.env scripts/test-video-gen.ts
 */

import { scrapeHN } from "../lib/workers/scraper-hn";
import { generateVideo } from "../lib/workers/video-gen";

async function main() {
  console.log("=== test-video-gen (HN slideshow) ===\n");

  // 1. Fetch one HN story
  console.log("[1/2] Fetching from Hacker News...");
  const posts = await scrapeHN();

  if (posts.length === 0) {
    console.error("No posts found — HN API may be down.");
    process.exit(1);
  }

  const post = posts[0];
  console.log(`  title:  ${post.title}`);
  console.log(`  url:    ${post.url}`);
  console.log(`  score:  ${post.score}\n`);

  // 2. Generate slideshow video
  const jobId = `test-${Date.now()}`;
  console.log(`[2/2] Generating video (jobId: ${jobId})...`);
  const { videoPath, durationSeconds } = await generateVideo(
    jobId,
    post.title,
    post.url,
    post.score
  );

  console.log(`\n✓ Done!`);
  console.log(`  Output:   ${videoPath}`);
  console.log(`  Duration: ${durationSeconds}s`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message ?? err);
  process.exit(1);
});
