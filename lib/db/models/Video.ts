import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IVideo extends Document {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  title: string;
  platform: string;
  externalId: string;
  viewCount: number;
  publishedAt: Date;
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
    externalId: { type: String, required: true },
    viewCount: { type: Number, default: 0 },
    publishedAt: { type: Date, required: true },
    driveFileId: { type: String, default: null },
    driveFolderId: { type: String, default: null },
    driveWebViewLink: { type: String, default: null },
  },
  { timestamps: true }
);

export const Video: Model<IVideo> =
  mongoose.models.Video ?? mongoose.model<IVideo>("Video", VideoSchema);
