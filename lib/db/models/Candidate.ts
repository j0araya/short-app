import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Candidate — a scraped HN post not yet converted into a Job.
 *
 * The pipeline scrapes HN and saves Candidates.
 * The user selects candidates in /select, chooses format + platforms,
 * and triggers generation — which creates a Job from the Candidate.
 */

export type CandidateStatus = "new" | "selected" | "skipped";

export interface ICandidate extends Document {
  _id: Types.ObjectId;
  /** HN item URL — dedup key */
  sourceUrl: string;
  title: string;
  /** External article or YouTube URL linked from HN */
  articleUrl: string | null;
  /** true if articleUrl is a YouTube video */
  hasVideo: boolean;
  /** HN score at time of scraping */
  score: number;
  /** OG image URL fetched from articleUrl (null if unavailable) */
  ogImageUrl: string | null;
  source: string;
  status: CandidateStatus;
  /** Set when user picks this candidate in /select */
  selectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema = new Schema<ICandidate>(
  {
    sourceUrl: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    articleUrl: { type: String, default: null },
    hasVideo: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    ogImageUrl: { type: String, default: null },
    source: { type: String, default: "hackernews" },
    status: {
      type: String,
      enum: ["new", "selected", "skipped"],
      default: "new",
    },
    selectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Candidate: Model<ICandidate> =
  mongoose.models.Candidate ?? mongoose.model<ICandidate>("Candidate", CandidateSchema);
