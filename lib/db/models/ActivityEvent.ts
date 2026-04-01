/**
 * ActivityEvent — lightweight append-only log of pipeline events.
 *
 * Events are emitted by the worker and the publish route, then surfaced
 * in the sidebar activity feed. No updates, no deletes — insert only.
 *
 * Types:
 *   video_generating  — worker started generating the video
 *   video_ready       — video generated + uploaded to Drive, pending review
 *   video_published   — video published to a platform
 *   job_failed        — job failed at any stage
 */

import mongoose, { Document, Schema, Types } from "mongoose";

export type ActivityEventType =
  | "video_generating"
  | "video_ready"
  | "video_published"
  | "job_failed";

export interface IActivityEvent extends Document {
  type: ActivityEventType;
  /** Short human-readable title of the story */
  title: string;
  /** Optional: platform where the video was published */
  platform?: string;
  /** Optional: public URL of the published video */
  url?: string;
  /** Optional: reference to the Job document */
  jobId?: Types.ObjectId;
  /** Optional: reference to the Video document */
  videoId?: Types.ObjectId;
  /** Optional: error message for job_failed events */
  errorMsg?: string;
  createdAt: Date;
}

const ActivityEventSchema = new Schema<IActivityEvent>(
  {
    type: {
      type: String,
      enum: ["video_generating", "video_ready", "video_published", "job_failed"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    platform: { type: String },
    url: { type: String },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    videoId: { type: Schema.Types.ObjectId, ref: "Video" },
    errorMsg: { type: String },
  },
  {
    // Only createdAt — no updatedAt, this log is immutable
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index: auto-delete events older than 7 days to keep the log lean
ActivityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const ActivityEvent =
  (mongoose.models.ActivityEvent as mongoose.Model<IActivityEvent>) ??
  mongoose.model<IActivityEvent>("ActivityEvent", ActivityEventSchema);
