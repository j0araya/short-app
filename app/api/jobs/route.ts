import { NextRequest, NextResponse } from "next/server";
import { connectDB, Job, Video, Candidate } from "@/lib/db";
import { pipelineQueue } from "@/lib/queue/client";
import { projectConfig } from "@/project.config";
import type { ContentType } from "@/lib/db/models/Job";

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

/**
 * POST /api/jobs
 *
 * Creates a Job from a Candidate and enqueues video generation.
 * Body: { candidateId, contentType, platforms }
 */
export async function POST(req: NextRequest) {
  await connectDB();

  const body = await req.json() as {
    candidateId: string;
    contentType?: ContentType;
    platforms?: string[];
  };

  const { candidateId, contentType = "short_video", platforms } = body;

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await Candidate.findById(candidateId).lean();
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const platform = platforms?.[0] ?? projectConfig.platforms[0];

  // Check dedup — don't re-create if already processed
  const existing = await Job.findOne({ sourceUrl: candidate.sourceUrl }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "Job already exists for this candidate", jobId: String(existing._id) },
      { status: 409 }
    );
  }

  // Create Job
  const job = await Job.create({
    title: candidate.title,
    sourceUrl: candidate.sourceUrl,
    articleUrl: candidate.articleUrl,
    hasVideo: candidate.hasVideo,
    thumbnail: candidate.ogImageUrl,
    niche: projectConfig.niche,
    platform,
    contentType,
    status: "pending",
  });

  // Mark candidate as selected
  await Candidate.findByIdAndUpdate(candidateId, {
    status: "selected",
    selectedAt: new Date(),
  });

  // Enqueue generation
  await pipelineQueue.add("generate:single", { jobId: String(job._id) }, {
    jobId: `generate-${String(job._id)}`,
  });

  await Job.findByIdAndUpdate(job._id, { status: "processing" });

  return NextResponse.json({ jobId: String(job._id) }, { status: 201 });
}

