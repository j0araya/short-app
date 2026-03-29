import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { video: true },
  });
  return NextResponse.json(jobs);
}
