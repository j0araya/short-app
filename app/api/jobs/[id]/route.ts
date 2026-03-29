import { NextResponse } from "next/server";
import { connectDB, Job, Video } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await connectDB();

  const job = await Job.findById(id).lean();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const video = await Video.findOne({ jobId: job._id }).lean();

  return NextResponse.json({ ...job, id: String(job._id), video: video ?? null });
}
