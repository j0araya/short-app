/**
 * scripts/publish-veo-to-youtube.ts
 *
 * Standalone: generate a short video with Veo 2 and publish it directly to
 * YouTube Shorts. Does NOT require Redis/BullMQ or MongoDB.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/publish-veo-to-youtube.ts
 *   npx tsx --env-file=.env scripts/publish-veo-to-youtube.ts "your custom prompt"
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { generateVideoWithVeo } from "../lib/workers/comment-pipeline";
import { YouTubeAdapter } from "../lib/adapters/youtube";

const TMP_DIR = "/tmp/short-app/veo-publish";
const DEFAULT_PROMPT =
  "A futuristic city skyline at night with neon lights and flying cars, " +
  "cinematic 9:16 vertical shot, ultra-realistic, tech aesthetic, no text, no logos";

async function main() {
  const prompt = process.argv[2]?.trim() || DEFAULT_PROMPT;
  const title  = process.argv[3]?.trim() || "AI Generated Short #Shorts";

  console.log("=== publish-veo-to-youtube ===\n");
  console.log(`Prompt: ${prompt}`);
  console.log(`Title:  ${title}\n`);

  // Ensure tmp dir
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const outputPath = path.join(TMP_DIR, `veo-${Date.now()}.mp4`);

  // 1. Generate with Veo 2
  console.log("[1/2] Generating video with Veo 2 (up to 5 min)...");
  await generateVideoWithVeo(prompt, outputPath);

  const stat = fs.statSync(outputPath);
  console.log(`  ✓ Video ready: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)\n`);

  // 2. Upload to YouTube Shorts
  console.log("[2/2] Uploading to YouTube Shorts...");
  const adapter = new YouTubeAdapter();
  const jobId   = `veo-${Date.now()}`;
  const result  = await adapter.upload(jobId, outputPath, title, {
    description: `${title}\n\nGenerated with Google Veo 2 AI.\n\nPrompt: "${prompt}"`,
    hashtags:    "#Shorts #AI #Veo2 #GenerativeAI #AIVideo",
  });

  console.log(`\n✓ Published!`);
  console.log(`  YouTube URL: ${result.url}`);
  console.log(`  Video ID:    ${result.externalId}`);

  // Clean up
  try { fs.unlinkSync(outputPath); } catch { /* non-fatal */ }
}

main().catch((err) => {
  console.error("\n✗ Error:", (err as Error).message ?? err);
  process.exit(1);
});
