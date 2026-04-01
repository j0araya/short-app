/**
 * Google Drive upload helper
 *
 * Folder structure:
 *   shorts/
 *     2026-03-29/          ← date
 *       youtube/           ← platform
 *         title_desc.mp4   ← sanitized title + short description slug
 *       tiktok/
 *         title_desc.mp4
 *
 * Root "shorts" and all sub-folders are created on demand and reused.
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
  return new Date().toISOString().slice(0, 10); // "2026-03-29"
}

/**
 * Sanitizes a string for use as a filename segment.
 * Lowercases, replaces non-alphanumeric with underscores, trims edges.
 */
function slugify(text: string, maxLen = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, "");
}

/**
 * Builds a short keyword slug from a title — used as the filename.
 * Filters common stop-words, takes the first `maxWords` meaningful words.
 * Example: "OpenAI releases GPT-5 with multimodal reasoning" → "openai_releases_gpt5_multimodal_reasoning"
 */
function shortDescSlug(title: string, maxWords = 6): string {
  const STOP = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "is", "are", "was", "with", "by", "from", "as", "its"]);
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter((w) => w.length > 1 && !STOP.has(w));

  const slug = words.slice(0, maxWords).join("_");
  return slug.slice(0, 60) || slugify(title, 60);
}

// ── MIME helper ───────────────────────────────────────────────────────────────

function mimeForExt(ext: string): string {
  if (ext === ".png")                return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4")                return "video/mp4";
  return "application/octet-stream";
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function uploadToDrive(
  videoPath: string,
  platform: string,
  title: string
): Promise<DriveUploadResult> {
  const drive = getDriveClient();

  // 1. /shorts
  const rootId = await findOrCreateFolder(DRIVE_ROOT_FOLDER);

  // 2. /shorts/YYYY-MM-DD
  const dayFolderId = await findOrCreateFolder(todayLabel(), rootId);

  // 3. /shorts/YYYY-MM-DD/<platform>
  const platformFolderId = await findOrCreateFolder(platform, dayFolderId);

  // 4. Filename: keyword slug derived from the title (5 key words, no stop-words).
  //    Date and platform live in the folder path — no need to repeat them here.
  const ext      = path.extname(videoPath) || ".mp4";
  const fileName = shortDescSlug(title, 6) + ext;

  // 5. Upload
  const fileStream = fs.createReadStream(videoPath);

  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [platformFolderId],
    },
    media: {
      mimeType: mimeForExt(ext),
      body:     fileStream,
    },
    fields: "id, webViewLink",
  });

  const fileId      = uploaded.data.id as string;
  const webViewLink = uploaded.data.webViewLink
    ?? `https://drive.google.com/file/d/${fileId}/view`;

  return { fileId, folderId: platformFolderId, webViewLink };
}

