/**
 * DELETE /api/drive/cleanup?olderThan=N
 *
 * Permanently deletes all daily folders in /shorts/ older than N days.
 * N defaults to 30 if not provided.
 *
 * Response:
 *   { deleted: string[], errors: { folder, error }[], deletedCount: number }
 */

import { NextResponse } from "next/server";
import { deleteVideosBefore } from "@/lib/drive/cleanup";

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("olderThan");
  const days = raw ? parseInt(raw, 10) : 30;

  if (isNaN(days) || days < 1) {
    return NextResponse.json(
      { error: "olderThan must be a positive integer (days)" },
      { status: 400 }
    );
  }

  try {
    const result = await deleteVideosBefore(days);

    return NextResponse.json({
      deleted: result.deleted,
      errors: result.errors,
      deletedCount: result.deleted.length,
      message:
        result.deleted.length === 0
          ? `No folders older than ${days} days found`
          : `Deleted ${result.deleted.length} folder(s) older than ${days} days`,
    });
  } catch (err) {
    console.error("[/api/drive/cleanup] error:", err);
    return NextResponse.json({ error: "Drive cleanup failed" }, { status: 500 });
  }
}
