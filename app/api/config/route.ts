import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { projectConfig } from "@/project.config";
import { projectConfigSchema } from "@/lib/config/schema";

export async function GET() {
  const stored = await prisma.config.findUnique({ where: { id: "singleton" } });
  const overrides = stored ? JSON.parse(stored.data) : {};

  return NextResponse.json({ ...projectConfig, ...overrides });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = projectConfigSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.config.upsert({
    where: { id: "singleton" },
    update: { data: JSON.stringify(parsed.data) },
    create: { id: "singleton", data: JSON.stringify(parsed.data) },
  });

  return NextResponse.json({ success: true, saved: parsed.data });
}
