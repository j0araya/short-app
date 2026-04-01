/**
 * PipelineLog — detailed step-by-step execution log for pipeline jobs.
 *
 * Each document is one log line emitted by the worker, video-gen, uploader,
 * scraper, or caption modules. Together they form a full audit trail for a Job.
 *
 * This is separate from ActivityEvent (which is a coarse-grained event feed
 * for the sidebar). PipelineLog captures everything: stdout/stderr, timing,
 * and step boundaries.
 *
 * TTL: 30 days (vs. ActivityEvent's 7 days — logs are more valuable longer).
 */

import mongoose, { Document, Schema, Types } from "mongoose";

export type PipelineLogLevel = "info" | "warn" | "error";

export type PipelineLogStep =
  | "scrape"
  | "generate"
  | "upload"
  | "publish"
  | "caption"
  | "worker";

export interface IPipelineLog extends Document {
  /** Reference to the Job this log belongs to */
  jobId: Types.ObjectId;
  /** Pipeline step that produced this log line */
  step: PipelineLogStep;
  /** Severity level */
  level: PipelineLogLevel;
  /** Log message — may include full stderr/stdout lines */
  message: string;
  /** Elapsed ms from step start (optional — set on step-boundary entries) */
  durationMs?: number;
  createdAt: Date;
}

const PipelineLogSchema = new Schema<IPipelineLog>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    step: {
      type: String,
      enum: ["scrape", "generate", "upload", "publish", "caption", "worker"],
      required: true,
      index: true,
    },
    level: {
      type: String,
      enum: ["info", "warn", "error"],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    durationMs: { type: Number },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for the most common query: all logs for a job, sorted by time
PipelineLogSchema.index({ jobId: 1, createdAt: 1 });

// TTL index: auto-delete logs older than 30 days
PipelineLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const PipelineLog =
  (mongoose.models.PipelineLog as mongoose.Model<IPipelineLog>) ??
  mongoose.model<IPipelineLog>("PipelineLog", PipelineLogSchema);
