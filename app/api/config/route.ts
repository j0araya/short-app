import { NextResponse } from "next/server";
import { connectDB, Config } from "@/lib/db";
import { projectConfig } from "@/project.config";
import { projectConfigSchema } from "@/lib/config/schema";

export async function GET() {
  await connectDB();

  const stored = await Config.findOne({ id: "singleton" }).lean();
  const overrides = stored ? JSON.parse(stored.data) : {};

  return NextResponse.json({ ...projectConfig, ...overrides });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = projectConfigSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();

  await Config.findOneAndUpdate(
    { id: "singleton" },
    { id: "singleton", data: JSON.stringify(parsed.data) },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, saved: parsed.data });
}
