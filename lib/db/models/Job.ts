import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface IJob extends Document {
  _id: Types.ObjectId;
  title: string;
  sourceUrl: string;
  thumbnail: string | null;
  niche: string;
  platform: string;
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
    thumbnail: { type: String, default: null },
    niche: { type: String, required: true },
    platform: { type: String, required: true },
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
