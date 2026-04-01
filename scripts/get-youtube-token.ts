/**
 * scripts/get-youtube-token.ts
 *
 * Generates a new YOUTUBE_REFRESH_TOKEN with all required scopes:
 *   - youtube.upload          (upload videos)
 *   - youtube.force-ssl       (read/write comments, manage channel)
 *   - youtube.readonly        (read channel data)
 *
 * Usage:
 *   npx tsx scripts/get-youtube-token.ts
 *
 * Then open the printed URL in your browser and authorize.
 * The token will be printed automatically after the redirect.
 *
 * IMPORTANT: Add http://localhost:4444/oauth2callback to the
 * "Authorized redirect URIs" in your Google Cloud OAuth2 client config.
 */

import { google } from "googleapis";
import * as http from "http";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;

if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error("Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env");
  process.exit(1);
}

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.readonly",
];

const REDIRECT_URI = "http://localhost:4444/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // forces refresh_token even if already authorized
});

console.log("\n── Step 1 ─────────────────────────────────────────────────────");
console.log("Open this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for Google to redirect to localhost:4444…\n");

// Spin up a temporary local server to catch the OAuth2 redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost:4444");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`<h2>Authorization failed: ${error}</h2>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.end("<h2>No code received.</h2>");
    return;
  }

  res.end("<h2>Authorization successful! You can close this tab.</h2>");
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("── Result ─────────────────────────────────────────────────────");
    console.log("Add this to your .env:\n");
    console.log(`YOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"`);
    console.log("\nScopes granted:", tokens.scope);
  } catch (err) {
    console.error("Failed to exchange code for token:", err);
    process.exit(1);
  }
});

server.listen(4444);
