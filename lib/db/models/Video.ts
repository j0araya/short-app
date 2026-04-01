import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { ContentType } from "./Job";

export type PublishStatus = "pending_publish" | "published";

export interface IVideo extends Document {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  title: string;
  platform: string;
  /** Content format — mirrors Job.contentType */
  contentType: ContentType;
  externalId: string;      // YouTube/Instagram media ID after publish (empty before)
  viewCount: number;
  publishedAt: Date | null;
  publishStatus: PublishStatus;
  sourceArticleUrl: string | null; // original article / YT video URL
  hasVideo: boolean;               // true if source was a YouTube video
  /** Generated Instagram caption */
  instagramCaption: string | null;
  /** Generated Instagram hashtags string, e.g. "#tech #ai #reels" */
  instagramHashtags: string | null;
  /** Generated YouTube description (with article URL + CTA) */
  youtubeDescription: string | null;
  /** Generated YouTube hashtags string, e.g. "#Shorts #tech #AI" */
  youtubeHashtags: string | null;
  /** Generated TikTok description */
  tiktokDescription: string | null;
  /** Generated TikTok hashtags */
  tiktokHashtags: string | null;
  /** Google Drive file ID (null if Drive upload was skipped or failed) */
  driveFileId: string | null;
  /** Google Drive parent folder ID for the daily folder */
  driveFolderId: string | null;
  /** Direct webViewLink for the file in Drive */
  driveWebViewLink: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    title: { type: String, required: true },
    platform: { type: String, required: true },
    contentType: {
      type: String,
      enum: ["short_video", "instagram_reel", "instagram_post"],
      default: "short_video",
    },
    externalId: { type: String, default: "" },
    viewCount: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    publishStatus: {
      type: String,
      enum: ["pending_publish", "published"],
      default: "pending_publish",
    },
    sourceArticleUrl: { type: String, default: null },
    hasVideo: { type: Boolean, default: false },
    instagramCaption: { type: String, default: null },
    instagramHashtags: { type: String, default: null },
    youtubeDescription: { type: String, default: null },
    youtubeHashtags: { type: String, default: null },
    tiktokDescription: { type: String, default: null },
    tiktokHashtags: { type: String, default: null },
    driveFileId: { type: String, default: null },
    driveFolderId: { type: String, default: null },
    driveWebViewLink: { type: String, default: null },
  },
  { timestamps: true }
);

export const Video: Model<IVideo> =
  mongoose.models.Video ?? mongoose.model<IVideo>("Video", VideoSchema);
