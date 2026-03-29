/**
 * BullMQ Worker
 *
 * Processes pipeline jobs in sequence: scrape → generate video → upload.
 * Run this as a standalone process: `npx tsx lib/queue/worker.ts`
 *
 * The worker reads configuration from projectConfig — no hardcoded values.
 */

import { Worker } from "bullmq";
import { redisConnection } from "./client";
import { scrapeReddit } from "@/lib/workers/scraper";
import { generateVideo } from "@/lib/workers/video-gen";
import { uploadVideo } from "@/lib/workers/uploader";
import { connectDB, Job } from "@/lib/db";
import { projectConfig } from "@/project.config";

export const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    console.log(`[worker] processing job ${job.id}, type: ${job.name}`);

    if (job.name === "pipeline:run") {
      await connectDB();

      // Step 1: Scrape
      const posts = await scrapeReddit();
      if (posts.length === 0) {
        console.log("[worker] no new posts found — job complete with 0 items");
        return { processed: 0 };
      }

      // Step 2: Create DB records and generate + upload each post
      let processed = 0;
      for (const post of posts) {
        const platform = projectConfig.platforms[0]; // use first configured platform

        const dbJob = await Job.create({
          title: post.title,
          sourceUrl: post.url,
          thumbnail: post.thumbnail,
          niche: projectConfig.niche,
          platform,
          status: "processing",
        });

        try {
          const { videoPath } = await generateVideo(String(dbJob._id), post.title, post.thumbnail);

          await Job.findByIdAndUpdate(dbJob._id, { videoPath, status: "processing" });

          await uploadVideo(String(dbJob._id));
          processed++;
        } catch (err) {
          await Job.findByIdAndUpdate(dbJob._id, {
            status: "failed",
            errorMsg: err instanceof Error ? err.message : String(err),
          });
          console.error(`[worker] job ${dbJob._id} failed:`, err);
        }
      }

      return { processed };
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  {
    connection: redisConnection,
    concurrency: 1, // process one at a time to respect API rate limits
  }
);

pipelineWorker.on("completed", (job, result) => {
  console.log(`[worker] job ${job.id} completed:`, result);
});

pipelineWorker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log("[worker] pipeline worker started, waiting for jobs...");
