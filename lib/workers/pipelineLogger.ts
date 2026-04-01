/**
 * pipelineLogger.ts
 *
 * Thin wrapper over PipelineLog that the worker, video-gen, uploader,
 * and scraper modules use to emit structured log lines.
 *
 * All writes are fire-and-forget (non-fatal) — a logging failure must
 * never break the pipeline.
 *
 * Usage:
 *   import { pLog } from "@/lib/workers/pipelineLogger";
 *   await pLog(jobId, "generate", "info", "Slide 1/4 — hook built");
 *   await pLog(jobId, "generate", "error", err.message, { durationMs: elapsed });
 */

import { PipelineLog } from "@/lib/db/models/PipelineLog";
import type { PipelineLogStep, PipelineLogLevel } from "@/lib/db/models/PipelineLog";
import { Types } from "mongoose";

export async function pLog(
  jobId: string | Types.ObjectId,
  step: PipelineLogStep,
  level: PipelineLogLevel,
  message: string,
  opts?: { durationMs?: number }
): Promise<void> {
  try {
    await PipelineLog.create({
      jobId: typeof jobId === "string" ? new Types.ObjectId(jobId) : jobId,
      step,
      level,
      message,
      durationMs: opts?.durationMs,
    });
  } catch {
    // Non-fatal — logging must never break the pipeline
  }
}
