/**
 * CommentJob model
 *
 * Tracks each "comment-driven generation" run so we:
 *   - avoid regenerating for the same set of comments
 *   - surface the result in the review page
 *   - keep an audit trail per source video
 */

import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type CommentJobStatus = "pending" | "processing" | "done" | "failed";

export interface IVideoAttributes {
  /** Main subject action, e.g. "eating bread" */
  action: string;
  /** Scene background, e.g. "sunset beach" */
  background: string;
  /** Visual / design style, e.g. "cinematic", "anime", "lo-fi" */
  style: string;
  /** Suggested music mood / genre, e.g. "upbeat pop" */
  musicMood: string;
  /** Full Veo video prompt derived from the above */
  videoPrompt: string;
}

export interface ICommentJob extends Document {
  _id: Types.ObjectId;

  /** YouTube video ID that was polled for comments */
  sourceVideoId: string;

  /** Reference to our Video document for the source video */
  sourceVideoDocId: Types.ObjectId | null;

  /** The 5 comment texts used as input */
  comments: string[];

  /** Fingerprint of comments (sorted + joined sha256-like hash) to detect duplicates */
  commentsHash: string;

  /** Attributes extracted by Gemini from the comments */
  attributes: IVideoAttributes | null;

  /** YouTube Audio Library track info selected for this video */
  music: {
    title: string;
    artist: string;
    youtubeUrl: string;
    mood: string;
  } | null;

  /** Path to the generated video file in /tmp */
  videoPath: string | null;

  /** Drive upload result */
  driveFileId: string | null;
  driveFolderId: string | null;
  driveWebViewLink: string | null;

  /** Reference to the Video document created after upload */
  outputVideoId: Types.ObjectId | null;

  status: CommentJobStatus;
  errorMsg: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const VideoAttributesSchema = new Schema<IVideoAttributes>(
  {
    action:      { type: String, required: true },
    background:  { type: String, required: true },
    style:       { type: String, required: true },
    musicMood:   { type: String, required: true },
    videoPrompt: { type: String, required: true },
  },
  { _id: false }
);

const CommentJobSchema = new Schema<ICommentJob>(
  {
    sourceVideoId:    { type: String, required: true },
    sourceVideoDocId: { type: Schema.Types.ObjectId, ref: "Video", default: null },
    comments:         { type: [String], default: [] },
    commentsHash:     { type: String, required: true },
    attributes:       { type: VideoAttributesSchema, default: null },
    music: {
      type: new Schema(
        {
          title:      String,
          artist:     String,
          youtubeUrl: String,
          mood:       String,
        },
        { _id: false }
      ),
      default: null,
    },
    videoPath:      { type: String, default: null },
    driveFileId:    { type: String, default: null },
    driveFolderId:  { type: String, default: null },
    driveWebViewLink: { type: String, default: null },
    outputVideoId:  { type: Schema.Types.ObjectId, ref: "Video", default: null },
    status:         { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending" },
    errorMsg:       { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent re-processing the exact same set of comments for the same video
CommentJobSchema.index({ sourceVideoId: 1, commentsHash: 1 }, { unique: true });
// TTL — auto-delete after 90 days
CommentJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const CommentJob: Model<ICommentJob> =
  mongoose.models.CommentJob ?? mongoose.model<ICommentJob>("CommentJob", CommentJobSchema);
