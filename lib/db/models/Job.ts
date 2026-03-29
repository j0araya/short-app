import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type JobStatus = "pending" | "processing" | "done" | "failed";

/**
 * short_video  — YouTube Shorts / TikTok style (9:16, silent, subtitle or OG-image slideshow)
 * instagram_reel — 9:16 video with IG-styled slides, destined for Instagram Reels
 * instagram_post — static image carousel (PNG set) for Instagram feed post
 */
export type ContentType = "short_video" | "instagram_reel" | "instagram_post";

export interface IJob extends Document {
  _id: Types.ObjectId;
  title: string;
  sourceUrl: string;           // HN item URL (dedup key)
  articleUrl: string | null;   // external article/video URL linked from HN
  hasVideo: boolean;           // true if articleUrl is a YouTube video
  thumbnail: string | null;
  niche: string;
  /** Target platform(s) — comma-separated for multi-platform jobs */
  platform: string;
  /** What kind of content to generate */
  contentType: ContentType;
  status: JobStatus;
  videoPath: string | null;
  errorMsg: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true },
    sourceUrl: { type: String, required: true, unique: true },
    articleUrl: { type: String, default: null },
    hasVideo: { type: Boolean, default: false },
    thumbnail: { type: String, default: null },
    niche: { type: String, required: true },
    platform: { type: String, required: true },
    contentType: {
      type: String,
      enum: ["short_video", "instagram_reel", "instagram_post"],
      default: "short_video",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "done", "failed"],
      default: "pending",
    },
    videoPath: { type: String, default: null },
    errorMsg: { type: String, default: null },
  },
  { timestamps: true }
);

export const Job: Model<IJob> =
  mongoose.models.Job ?? mongoose.model<IJob>("Job", JobSchema);
