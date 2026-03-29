/**
 * Google Drive upload helper
 *
 * Structure:
 *   /shorts/
 *     2026-03-28/
 *       youtube_20260328_titulo.mp4
 *       tiktok_20260328_titulo.mp4
 *
 * Root folder "shorts" is looked up by name and created if missing.
 * Daily sub-folders are created on demand and reused across uploads.
 */

import fs from "fs";
import path from "path";
import { getDriveClient } from "./client";

const DRIVE_ROOT_FOLDER = "shorts";

export interface DriveUploadResult {
  fileId: string;
  folderId: string;
  webViewLink: string;
}

// ── Folder helpers ────────────────────────────────────────────────────────────

async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const drive = getDriveClient();

  const q = [
    `name = '${name}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : `'root' in parents`,
  ].join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id as string;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : ["root"],
    },
    fields: "id",
  });

  return created.data.id as string;
}

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10); // "2026-03-28"
}

function dateCompact(): string {
  return todayLabel().replace(/-/g, ""); // "20260328"
}

function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 50)
    .replace(/^_|_$/g, "");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function uploadToDrive(
  videoPath: string,
  platform: string,
  title: string
): Promise<DriveUploadResult> {
  const drive = getDriveClient();

  // 1. Ensure /shorts root folder exists
  const rootId = await findOrCreateFolder(DRIVE_ROOT_FOLDER);

  // 2. Ensure /shorts/YYYY-MM-DD/ folder exists
  const dayLabel = todayLabel();
  const dayFolderId = await findOrCreateFolder(dayLabel, rootId);

  // 3. Build filename: platform_YYYYMMDD_sanitized_title.mp4
  const ext = path.extname(videoPath) || ".mp4";
  const fileName = `${platform}_${dateCompact()}_${sanitizeTitle(title)}${ext}`;

  // 4. Upload the file
  const fileStream = fs.createReadStream(videoPath);
  const mimeType = ext === ".mp4" ? "video/mp4" : "video/quicktime";

  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [dayFolderId],
    },
    media: {
      mimeType,
      body: fileStream,
    },
    fields: "id, webViewLink",
  });

  const fileId = uploaded.data.id as string;
  const webViewLink = uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  return { fileId, folderId: dayFolderId, webViewLink };
}
