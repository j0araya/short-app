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
import { runCommentPipelineForAllVideos } from "@/lib/workers/comment-pipeline";
import { connectDB, Job, Candidate, ActivityEvent } from "@/lib/db";
import { pLog } from "@/lib/workers/pipelineLogger";
import { projectConfig } from "@/project.config";
import { pipelineQueue } from "./client";

// ── Heartbeat ─────────────────────────────────────────────────────────────────
// Sets a Redis key that expires in 60s. The health endpoint reads this key
// to determine whether the worker process is alive.
const HEARTBEAT_KEY = "worker:heartbeat";
const HEARTBEAT_INTERVAL_MS = 20_000; // refresh every 20s, TTL is 60s

async function sendHeartbeat() {
  try {
    await redisConnection.set(HEARTBEAT_KEY, Date.now(), "EX", 60);
  } catch {
    // Non-fatal — health endpoint will show worker as offline
  }
}

// Send immediately and then on interval
sendHeartbeat();
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

export const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    console.log(`[worker] processing job ${job.id}, type: ${job.name}`);

    if (job.name === "pipeline:run") {
      await connectDB();

      // Step 1: Scrape HN and save as Candidates — only freshly saved ones proceed
      const { candidates: freshCandidates } = await scrapeAndSaveCandidates();
      console.log(`[worker] scraped ${freshCandidates.length} new candidates`);

      if (freshCandidates.length === 0) {
        console.log("[worker] no new stories found — nothing to process");
        return { processed: 0 };
      }

      let processed = 0;
      for (const candidate of freshCandidates) {
        const platform = projectConfig.platforms[0];

        // Guard: skip if a Job already exists for this story (shouldn't happen
        // since scrapeHN already deduplicates against Jobs, but be safe)
        const existingJob = await Job.findOne({ sourceUrl: candidate.sourceUrl }).lean();
        if (existingJob) {
          console.warn(`[worker] job already exists for ${candidate.sourceUrl} — skipping`);
          await Candidate.findByIdAndUpdate(candidate._id, { status: "selected" });
          continue;
        }

        let dbJob;
        try {
          dbJob = await Job.create({
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
        } catch (err: unknown) {
          // Duplicate key on Job — mark candidate as selected and skip
          if ((err as { code?: number }).code === 11000) {
            console.warn(`[worker] duplicate job for ${candidate.sourceUrl} — skipping`);
            await Candidate.findByIdAndUpdate(candidate._id, { status: "selected" });
            continue;
          }
          throw err;
        }

        // Only mark as selected after Job is created successfully
        await Candidate.findByIdAndUpdate(candidate._id, {
          status: "selected",
          selectedAt: new Date(),
        });

        // Emit: generation starting
        try {
          await ActivityEvent.create({
            type: "video_generating",
            title: candidate.title,
            platform,
            jobId: dbJob._id,
          });
        } catch { /* non-fatal */ }

        await pLog(dbJob._id, "worker", "info", `pipeline:run — starting job for "${candidate.title}"`);

        const stepStart = Date.now();
        try {
          await pLog(dbJob._id, "generate", "info", `Starting video generation (style: narrative)`);
          const { videoPath, carouselPaths } = await generateVideo(
            String(dbJob._id),
            candidate.title,
            candidate.articleUrl,
            candidate.score,
            candidate.hasVideo,
            "short_video",
            undefined,
            "narrative"
          );
          await pLog(dbJob._id, "generate", "info", `Video generation done`, { durationMs: Date.now() - stepStart });

          await Job.findByIdAndUpdate(dbJob._id, {
            videoPath: videoPath ?? null,
            carouselPaths: carouselPaths ?? null,
            status: "processing",
          });

          const uploadStart = Date.now();
          await pLog(dbJob._id, "upload", "info", `Starting Drive upload`);
          await uploadVideo(String(dbJob._id));
          await pLog(dbJob._id, "upload", "info", `Drive upload done`, { durationMs: Date.now() - uploadStart });

          processed++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[worker] job ${dbJob._id} failed:`, err);
          await pLog(dbJob._id, "worker", "error", errMsg, { durationMs: Date.now() - stepStart });
          await Job.findByIdAndUpdate(dbJob._id, {
            status: "failed",
            errorMsg: errMsg,
          });
          try {
            await ActivityEvent.create({
              type: "job_failed",
              title: candidate.title,
              platform,
              jobId: dbJob._id,
              errorMsg: errMsg,
            });
          } catch { /* non-fatal */ }
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

      // Mark as processing now that the worker has it
      await Job.findByIdAndUpdate(jobId, { status: "processing" });

      // Emit: generation starting
      try {
        await ActivityEvent.create({
          type: "video_generating",
          title: dbJob.title,
          platform: dbJob.platform,
          jobId: dbJob._id,
        });
      } catch { /* non-fatal */ }

      await pLog(jobId, "worker", "info", `generate:single — starting job for "${dbJob.title}"`);

      const stepStart = Date.now();
      try {
        await pLog(jobId, "generate", "info", `Starting video generation (style: ${dbJob.videoStyle ?? "narrative"})`);
        const { videoPath, carouselPaths } = await generateVideo(
          String(dbJob._id),
          dbJob.title,
          dbJob.articleUrl,
          dbJob.score ?? 0,
          dbJob.hasVideo,
          dbJob.contentType ?? "short_video",
          undefined,
          dbJob.videoStyle ?? "narrative"
        );
        await pLog(jobId, "generate", "info", `Video generation done`, { durationMs: Date.now() - stepStart });

        await Job.findByIdAndUpdate(dbJob._id, {
          videoPath: videoPath ?? null,
          carouselPaths: carouselPaths ?? null,
          status: "processing",
        });

        const uploadStart = Date.now();
        await pLog(jobId, "upload", "info", `Starting Drive upload`);
        await uploadVideo(String(dbJob._id));
        await pLog(jobId, "upload", "info", `Drive upload done`, { durationMs: Date.now() - uploadStart });

        return { jobId };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await pLog(jobId, "worker", "error", errMsg, { durationMs: Date.now() - stepStart });
        await Job.findByIdAndUpdate(dbJob._id, {
          status: "failed",
          errorMsg: errMsg,
        });
        try {
          await ActivityEvent.create({
            type: "job_failed",
            title: dbJob.title,
            platform: dbJob.platform,
            jobId: dbJob._id,
            errorMsg: errMsg,
          });
        } catch { /* non-fatal */ }
        throw err;
      }
    }

    // ── Comment-driven generation ─────────────────────────────────────────
    if (job.name === "comments:generate") {
      console.log("[worker] Running comment-driven pipeline for all published videos…");
      const result = await runCommentPipelineForAllVideos();
      console.log(
        `[worker] comments:generate done — processed: ${result.processed}, ` +
        `skipped: ${result.skipped}, errors: ${result.errors.length}`
      );
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          console.error(`[worker] comment pipeline error for ${e.videoId}: ${e.error}`);
        }
      }
      return result;
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

// ── Register repeatable jobs ───────────────────────────────────────────────────
// The comment pipeline runs every hour. Using upsert semantics: if the
// repeatable job already exists with the same key, BullMQ won't add a duplicate.

async function registerRepeatableJobs() {
  try {
    await pipelineQueue.add(
      "comments:generate",
      {},
      {
        jobId: "comments:generate:repeatable",
        repeat: { every: 60 * 60 * 1000 },   // every 1 hour in ms
        // dedupe: if a job with this key already exists, skip
      }
    );
    console.log("[worker] comments:generate repeatable job registered (every 1h)");
  } catch (err) {
    // Non-fatal — worker still processes manually triggered jobs
    console.warn("[worker] Failed to register repeatable job:", err);
  }
}

registerRepeatableJobs();
