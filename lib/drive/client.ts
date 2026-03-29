/**
 * Google Drive OAuth2 client
 *
 * Uses OAuth2 refresh token for clipshortnews@gmail.com.
 * Credentials come from env vars — never hardcoded.
 *
 * Required env vars:
 *   GOOGLE_DRIVE_CLIENT_ID
 *   GOOGLE_DRIVE_CLIENT_SECRET
 *   GOOGLE_DRIVE_REFRESH_TOKEN
 */

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

function createDriveClient(): drive_v3.Drive {
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error(
      "Missing Google Drive credentials. Set GOOGLE_DRIVE_CLIENT_ID, " +
        "GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN in .env"
    );
  }

  const auth = new google.auth.OAuth2(
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET
  );

  auth.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });

  return google.drive({ version: "v3", auth });
}

// Singleton — reuse across hot-reloads in development
const globalForDrive = globalThis as unknown as { drive: drive_v3.Drive | null };

export function getDriveClient(): drive_v3.Drive {
  if (!globalForDrive.drive) {
    globalForDrive.drive = createDriveClient();
  }
  return globalForDrive.drive;
}
