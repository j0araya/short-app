import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { uploadVideo } from "@/lib/workers/uploader";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
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
