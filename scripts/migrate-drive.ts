/**
 * Drive migration script
 *
 * Reorganizes existing files inside /shorts/ to match the canonical structure:
 *   shorts/YYYY-MM-DD/<platform>/<slug>.mp4
 *
 * For each file that does NOT live at exactly depth-3 inside /shorts/:
 *   - Date   → inferred from the file's `createdTime` in Drive
 *   - Platform → inferred from the file's current parent folder name
 *               (falls back to "youtube" if the parent is a date or root folder)
 *
 * Usage:
 *   npx tsx scripts/migrate-drive.ts           # dry-run (no changes)
 *   npx tsx scripts/migrate-drive.ts --apply   # apply changes
 */

import "dotenv/config";
import { getDriveClient } from "../lib/drive/client";

const DRY_RUN = !process.argv.includes("--apply");

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  parents: string[];
}

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const KNOWN_PLATFORMS = ["youtube", "tiktok", "instagram", "reels"];

function isDateFolder(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(name);
}

/**
 * Tries to infer the platform from the filename prefix.
 * e.g. "tiktok_20260329_foo.mp4"  → "tiktok"
 *      "youtube_20260329_bar.mp4" → "youtube"
 *      "tiktok20260329foo.mp4"    → "tiktok"   (post-slug, no separator)
 * Returns null if no known platform prefix found.
 */
function platformFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  for (const p of KNOWN_PLATFORMS) {
    // with separator: "tiktok_" or "tiktok-"
    if (lower.startsWith(p + "_") || lower.startsWith(p + "-")) return p;
    // without separator but followed by a digit: "tiktok2026..."
    if (lower.startsWith(p) && /^\d/.test(lower.slice(p.length))) return p;
  }
  return null;
}

function isVideoOrImage(mimeType: string): boolean {
  return mimeType.startsWith("video/") || mimeType.startsWith("image/");
}

/** slug used as filename — mirrors shortDescSlug in upload.ts */
function slugify(text: string, maxLen = 60): string {
  const STOP = new Set(["a","an","the","of","in","on","at","to","for","and","or","is","are","was","with","by","from","as","its"]);
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter((w) => w.length > 1 && !STOP.has(w));

  const slug = words.slice(0, 6).join("_");
  if (slug) return slug.slice(0, maxLen);

  // fallback: raw slugify
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, maxLen).replace(/^_+|_+$/g, "");
}

function dateFromCreatedTime(iso: string): string {
  return iso.slice(0, 10); // "2026-03-29"
}

// ── Drive helpers ─────────────────────────────────────────────────────────────

async function listAllInFolder(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, createdTime, parents)",
      spaces: "drive",
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      files.push(f as DriveFile);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/** Recursively collect all files under rootId. Returns flat list with their direct parent. */
async function collectAllFiles(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
  folderMap: Map<string, FolderNode>
): Promise<DriveFile[]> {
  const items = await listAllInFolder(drive, folderId);
  const results: DriveFile[] = [];

  for (const item of items) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      folderMap.set(item.id, { id: item.id, name: item.name, parentId: folderId });
      const children = await collectAllFiles(drive, item.id, folderMap);
      results.push(...children);
    } else if (isVideoOrImage(item.mimeType)) {
      results.push(item);
    }
  }

  return results;
}

/** Build ancestry path (names) from a file's parent up to rootId. */
function buildAncestors(
  parentId: string,
  rootId: string,
  folderMap: Map<string, FolderNode>
): string[] {
  const path: string[] = [];
  let current: string | null = parentId;

  while (current && current !== rootId) {
    const node = folderMap.get(current);
    if (!node) break;
    path.unshift(node.name);
    current = node.parentId;
  }

  return path; // e.g. ["2026-03-29", "youtube"] or ["youtube"] or ["old_stuff", "youtube"]
}

async function findOrCreateFolder(
  drive: ReturnType<typeof getDriveClient>,
  name: string,
  parentId: string,
  dryRun: boolean,
  fakeFolderMap: Map<string, string> // name:parentId → fakeId (for dry-run)
): Promise<string> {
  const cacheKey = `${parentId}::${name}`;

  if (dryRun) {
    if (!fakeFolderMap.has(cacheKey)) {
      fakeFolderMap.set(cacheKey, `dry-run-folder-${Math.random().toString(36).slice(2)}`);
    }
    return fakeFolderMap.get(cacheKey)!;
  }

  const res = await drive.files.list({
    q: [
      `name = '${name}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `trashed = false`,
      `'${parentId}' in parents`,
    ].join(" and "),
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id as string;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return created.data.id as string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Drive Migration (${DRY_RUN ? "DRY RUN — no changes" : "APPLY MODE"}) ===\n`);

  const drive = getDriveClient();

  // Resolve /shorts root
  const rootRes = await drive.files.list({
    q: `name = 'shorts' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const rootFolder = rootRes.data.files?.[0];
  if (!rootFolder) {
    console.log("No /shorts folder found in Drive. Nothing to migrate.");
    return;
  }

  console.log(`Found /shorts  →  ${rootFolder.id}\n`);

  // Collect all files + build folder map
  const folderMap = new Map<string, FolderNode>();
  folderMap.set(rootFolder.id!, { id: rootFolder.id!, name: "shorts", parentId: null });

  console.log("Scanning all files under /shorts/ ...");
  const allFiles = await collectAllFiles(drive, rootFolder.id!, folderMap);
  console.log(`Found ${allFiles.length} media file(s) total.\n`);

  // Categorize
  const conforming: DriveFile[] = [];
  const toMigrate: DriveFile[] = [];

  for (const file of allFiles) {
    const directParentId = file.parents[0];
    const ancestors = buildAncestors(directParentId, rootFolder.id!, folderMap);

    // Canonical: ancestors = ["YYYY-MM-DD", "<platform>"]
    // Also check that the platform folder matches the platform inferred from the filename.
    const structureOk =
      ancestors.length === 2 &&
      isDateFolder(ancestors[0]) &&
      ancestors[1].length > 0;

    const inferredPlatform = platformFromFilename(file.name);
    const platformMismatch =
      structureOk &&
      inferredPlatform !== null &&
      ancestors[1] !== inferredPlatform;

    if (structureOk && !platformMismatch) {
      conforming.push(file);
    } else {
      toMigrate.push(file);
    }
  }

  console.log(`✓ Already conforming : ${conforming.length}`);
  console.log(`✗ Need migration     : ${toMigrate.length}\n`);

  if (toMigrate.length === 0) {
    console.log("Nothing to migrate. All files are correctly structured.");
    return;
  }

  // Print what will happen
  const fakeFolderMap = new Map<string, string>();
  const results = { moved: 0, skipped: 0, errors: 0 };

  for (const file of toMigrate) {
    const directParentId = file.parents[0];
    const ancestors = buildAncestors(directParentId, rootFolder.id!, folderMap);
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop()! : ".mp4";

    // Infer date
    const date = dateFromCreatedTime(file.createdTime);

    // Infer platform: filename prefix takes priority, then folder ancestors, then fallback
    const platformFromName = platformFromFilename(file.name);
    const platformCandidate = ancestors
      .slice()
      .reverse()
      .find((a) => !isDateFolder(a) && a !== "shorts" && KNOWN_PLATFORMS.includes(a));
    const platform = platformFromName ?? platformCandidate ?? "youtube";

    // Build new filename from existing name
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    const newName = slugify(nameWithoutExt) + ext;

    console.log(`  FILE : ${file.name}`);
    console.log(`  PATH : shorts/${ancestors.join("/") || "(root)"}/${file.name}`);
    console.log(`  →    : shorts/${date}/${platform}/${newName}`);

    try {
      // Ensure target folders exist
      const dateFolderId = await findOrCreateFolder(drive, date, rootFolder.id!, DRY_RUN, fakeFolderMap);
      const platformFolderId = await findOrCreateFolder(drive, platform, dateFolderId, DRY_RUN, fakeFolderMap);

      if (!DRY_RUN) {
        // Move the file: add new parent, remove old parent
        await drive.files.update({
          fileId: file.id,
          addParents: platformFolderId,
          removeParents: directParentId,
          requestBody: { name: newName },
          fields: "id, parents, name",
        });
      }

      console.log(`  ${DRY_RUN ? "[dry-run] would move" : "MOVED"} ✓\n`);
      results.moved++;
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
      results.errors++;
    }
  }

  console.log("─────────────────────────────────────────");
  console.log(`Moved   : ${results.moved}`);
  console.log(`Errors  : ${results.errors}`);
  if (DRY_RUN) {
    console.log("\nThis was a DRY RUN. Re-run with --apply to make changes.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
