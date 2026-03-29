/**
 * Google Drive cleanup helper
 *
 * Deletes all daily sub-folders (and their contents) inside /shorts/
 * whose date label is older than `days` days ago.
 *
 * Example: deleteVideosBefore(3) deletes /shorts/2026-03-25/ and older.
 */

import { getDriveClient } from "./client";

const DRIVE_ROOT_FOLDER = "shorts";

export interface CleanupResult {
  deleted: string[];
  errors: { folder: string; error: string }[];
}

async function getRootFolderId(): Promise<string | null> {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: [
      `name = '${DRIVE_ROOT_FOLDER}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `trashed = false`,
      `'root' in parents`,
    ].join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
  });

  return res.data.files?.[0]?.id ?? null;
}

function parseFolderDate(name: string): Date | null {
  // Expects format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) return null;
  const d = new Date(name);
  return isNaN(d.getTime()) ? null : d;
}

export async function deleteVideosBefore(days: number): Promise<CleanupResult> {
  const drive = getDriveClient();
  const result: CleanupResult = { deleted: [], errors: [] };

  const rootId = await getRootFolderId();
  if (!rootId) {
    // No /shorts folder yet — nothing to clean up
    return result;
  }

  // List all daily sub-folders inside /shorts/
  const res = await drive.files.list({
    q: [
      `'${rootId}' in parents`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `trashed = false`,
    ].join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 365,
  });

  const folders = res.data.files ?? [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0); // midnight of cutoff day

  for (const folder of folders) {
    const folderDate = parseFolderDate(folder.name ?? "");
    if (!folderDate || folderDate >= cutoff) continue;

    try {
      // Trash = false means permanent delete
      await drive.files.delete({ fileId: folder.id as string });
      result.deleted.push(folder.name as string);
    } catch (err) {
      result.errors.push({
        folder: folder.name ?? folder.id ?? "unknown",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
