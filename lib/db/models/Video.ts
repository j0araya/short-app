import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IVideo extends Document {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  title: string;
  platform: string;
  externalId: string;
  viewCount: number;
  publishedAt: Date;
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
  },
  { timestamps: true }
);

export const Video: Model<IVideo> =
  mongoose.models.Video ?? mongoose.model<IVideo>("Video", VideoSchema);
