/**
 * BullMQ Worker
 *
 * Processes pipeline jobs in sequence: scrape → generate video → upload.
 * Run this as a standalone process: `npx tsx lib/queue/worker.ts`
 *
 * The worker reads configuration from projectConfig — no hardcoded values.
 *
 * Note: the automatic pipeline uses scrapeAndSaveCandidates() to persist
 * HN posts for manual review, then processes only "new" candidates.
 * Manual selection from the /select dashboard bypasses this flow.
 */

import { Worker } from "bullmq";
import { redisConnection } from "./client";
import { scrapeAndSaveCandidates } from "@/lib/workers/scraper-hn";
import { generateVideo } from "@/lib/workers/video-gen";
import { uploadVideo } from "@/lib/workers/uploader";
import { connectDB, Job, Candidate } from "@/lib/db";
import { projectConfig } from "@/project.config";

export const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    console.log(`[worker] processing job ${job.id}, type: ${job.name}`);

    if (job.name === "pipeline:run") {
      await connectDB();

      // Step 1: Scrape HN and save as Candidates
      const { saved } = await scrapeAndSaveCandidates();
      console.log(`[worker] scraped ${saved} new candidates`);

      // Step 2: Process all "new" candidates automatically
      const candidates = await Candidate.find({ status: "new" }).lean();
      if (candidates.length === 0) {
        console.log("[worker] no new candidates to process");
        return { processed: 0 };
      }

      let processed = 0;
      for (const candidate of candidates) {
        const platform = projectConfig.platforms[0];

        // Mark candidate as selected
        await Candidate.findByIdAndUpdate(candidate._id, {
          status: "selected",
          selectedAt: new Date(),
        });

        const dbJob = await Job.create({
          title: candidate.title,
          sourceUrl: candidate.sourceUrl,
          articleUrl: candidate.articleUrl,
          hasVideo: candidate.hasVideo,
          thumbnail: candidate.ogImageUrl,
          niche: projectConfig.niche,
          platform,
          contentType: "short_video",
          status: "processing",
        });

        try {
          const { videoPath } = await generateVideo(
            String(dbJob._id),
            candidate.title,
            candidate.articleUrl,
            candidate.score,
            candidate.hasVideo,
            "short_video"
          );

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

    // Single-job generation triggered from the /select dashboard
    if (job.name === "generate:single") {
      const { jobId } = job.data as { jobId: string };
      await connectDB();

      const dbJob = await Job.findById(jobId).lean();
      if (!dbJob) throw new Error(`Job ${jobId} not found`);

      try {
        const { videoPath } = await generateVideo(
          String(dbJob._id),
          dbJob.title,
          dbJob.articleUrl,
          0,
          dbJob.hasVideo,
          dbJob.contentType ?? "short_video"
        );

        await Job.findByIdAndUpdate(dbJob._id, { videoPath, status: "processing" });
        await uploadVideo(String(dbJob._id));
        return { jobId };
      } catch (err) {
        await Job.findByIdAndUpdate(dbJob._id, {
          status: "failed",
          errorMsg: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

pipelineWorker.on("completed", (job, result) => {
  console.log(`[worker] job ${job.id} completed:`, result);
});

pipelineWorker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log("[worker] pipeline worker started, waiting for jobs...");
