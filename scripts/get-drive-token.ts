/**
 * scripts/get-drive-token.ts
 *
 * One-time script to obtain a Google Drive refresh token for clipshortnews@gmail.com.
 *
 * Usage:
 *   1. Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to .env
 *   2. npx tsx scripts/get-drive-token.ts
 *   3. Open the URL printed in the terminal
 *   4. Authorize with clipshortnews@gmail.com
 *   5. Google redirects to localhost:3000/oauth2callback?code=...
 *      Copy the `code` value from the URL and paste it here when prompted
 *   6. The refresh token will be printed — copy it to .env as GOOGLE_DRIVE_REFRESH_TOKEN
 */

import { google } from "googleapis";
import * as readline from "readline";
import * as dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("ERROR: Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env first");
  process.exit(1);
}

// Redirect URI — must match exactly what you set in Google Cloud Console
const REDIRECT_URI = "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Scope: only Drive file access (files created by this app)
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // forces refresh_token to be returned every time
});

console.log("\n─────────────────────────────────────────────────────");
console.log("1. Open this URL in your browser (use clipshortnews@gmail.com):");
console.log("\n" + authUrl + "\n");
console.log("2. After authorizing, Google will redirect to:");
console.log("   http://localhost:3000/oauth2callback?code=XXXXXX");
console.log("3. Copy the value of the `code` parameter from the URL");
console.log("─────────────────────────────────────────────────────\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Paste the code here: ", async (code) => {
  rl.close();

  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error(
        "\nERROR: No refresh_token returned.\n" +
        "This usually means the app was already authorized without 'prompt: consent'.\n" +
        "Go to https://myaccount.google.com/permissions, revoke access for your app, then run this script again."
      );
      process.exit(1);
    }

    console.log("\n─────────────────────────────────────────────────────");
    console.log("SUCCESS! Add this to your .env file:");
    console.log("\nGOOGLE_DRIVE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("─────────────────────────────────────────────────────\n");
  } catch (err) {
    console.error("\nERROR exchanging code for tokens:", err);
    process.exit(1);
  }
});
