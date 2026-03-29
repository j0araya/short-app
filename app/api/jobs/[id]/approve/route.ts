import { NextResponse } from "next/server";
import { connectDB, Job } from "@/lib/db";
import { uploadVideo } from "@/lib/workers/uploader";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await connectDB();

  const job = await Job.findById(id).lean();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "done" && job.status !== "processing") {
    return NextResponse.json(
      { error: `Cannot approve job with status "${job.status}"` },
      { status: 400 }
    );
  }

  try {
    await uploadVideo(id);
    return NextResponse.json({ success: true, jobId: id });
  } catch (err) {
    console.error(`[/api/jobs/${id}/approve] error:`, err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
