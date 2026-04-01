/**
 * scripts/test-drive-upload.ts
 *
 * Standalone test: uploads an existing MP4 to Google Drive and prints the result.
 * Usage: npx tsx scripts/test-drive-upload.ts [/path/to/file.mp4]
 *
 * If no path is provided, uses the most recently modified MP4 in /tmp/short-app/.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { uploadToDrive } from "@/lib/drive/upload";

async function main() {
  let videoPath = process.argv[2];

  if (!videoPath) {
    const tmpDir = "/tmp/short-app";
    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith(".mp4"))
      .map((f) => ({ f, mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      console.error("No MP4 files found in /tmp/short-app/. Run test-video-gen first.");
      process.exit(1);
    }

    videoPath = path.join(tmpDir, files[0].f);
    console.log(`[test-drive-upload] No path given — using most recent: ${videoPath}`);
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`File not found: ${videoPath}`);
    process.exit(1);
  }

  console.log(`[test-drive-upload] Uploading ${videoPath} ...`);

  const result = await uploadToDrive(videoPath, "youtube", "Test Drive Upload");

  console.log("\n✓ Upload successful:");
  console.log(`  fileId      : ${result.fileId}`);
  console.log(`  folderId    : ${result.folderId}`);
  console.log(`  webViewLink : ${result.webViewLink}`);
}

main().catch((err) => {
  console.error("[test-drive-upload] FAILED:", err);
  process.exit(1);
});
