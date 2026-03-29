/**
 * Config model — single document pattern (singleton).
 * We always use id = "singleton" to upsert config overrides.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IConfig extends Document {
  id: string;
  data: string; // JSON string of partial ProjectConfig overrides
  createdAt: Date;
  updatedAt: Date;
}

const ConfigSchema = new Schema<IConfig>(
  {
    id: { type: String, required: true, unique: true },
    data: { type: String, required: true },
  },
  { timestamps: true }
);

export const Config: Model<IConfig> =
  mongoose.models.Config ?? mongoose.model<IConfig>("Config", ConfigSchema);
