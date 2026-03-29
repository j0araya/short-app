import { NextResponse } from "next/server";
import { connectDB, Job, Video } from "@/lib/db";

export async function GET() {
  await connectDB();

  const jobs = await Job.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Attach associated video to each job
  const jobIds = jobs.map((j) => j._id);
  const videos = await Video.find({ jobId: { $in: jobIds } }).lean();
  const videoMap = new Map(videos.map((v) => [String(v.jobId), v]));

  const result = jobs.map((j) => ({
    ...j,
    id: String(j._id),
    video: videoMap.get(String(j._id)) ?? null,
  }));

  return NextResponse.json(result);
}
