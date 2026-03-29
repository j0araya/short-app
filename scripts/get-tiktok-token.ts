/**
 * scripts/get-tiktok-token.ts
 *
 * One-time script to obtain TikTok access + refresh tokens via OAuth 2.0 PKCE flow.
 *
 * Usage:
 *   1. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to .env
 *   2. In the TikTok developer portal → your app → "Login Kit" → add redirect URI:
 *        http://localhost:3000/tiktok/callback
 *   3. npx tsx scripts/get-tiktok-token.ts
 *   4. Open the URL printed in the terminal and authorize with your TikTok account
 *   5. TikTok redirects to http://localhost:3000/tiktok/callback?code=XXXX&state=XXXX
 *      Copy the `code` value from the URL and paste it when prompted
 *   6. Copy the printed tokens to .env:
 *        TIKTOK_ACCESS_TOKEN=...
 *        TIKTOK_REFRESH_TOKEN=...
 *        TIKTOK_OPEN_ID=...
 *
 * Required scope: video.publish
 * Docs: https://developers.tiktok.com/doc/oauth-user-access-token-management
 */

import * as readline from "readline";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

dotenv.config();

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

if (!CLIENT_KEY || !CLIENT_SECRET) {
  console.error("ERROR: Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env first");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3000/tiktok/callback";
const SCOPES = "video.publish,user.info.basic";

// PKCE — TikTok requires code_verifier / code_challenge
const codeVerifier = crypto.randomBytes(32).toString("base64url");
const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

const state = crypto.randomBytes(8).toString("hex");

const authUrl =
  `https://www.tiktok.com/v2/auth/authorize/` +
  `?client_key=${encodeURIComponent(CLIENT_KEY)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${state}` +
  `&code_challenge=${codeChallenge}` +
  `&code_challenge_method=S256`;

console.log("\n─────────────────────────────────────────────────────────────");
console.log("1. Open this URL in your browser and log in with your TikTok account:");
console.log("\n" + authUrl + "\n");
console.log("2. After authorizing, TikTok will redirect to:");
console.log("   http://localhost:3000/tiktok/callback?code=XXXXX&state=" + state);
console.log("3. Copy the value of the `code` parameter from the URL");
console.log("─────────────────────────────────────────────────────────────\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Paste the code here: ", async (code) => {
  rl.close();

  try {
    const body = new URLSearchParams({
      client_key: CLIENT_KEY!,
      client_secret: CLIENT_SECRET!,
      code: code.trim(),
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      open_id?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || data.error) {
      console.error(
        "\nERROR exchanging code for tokens:",
        data.error_description ?? data.error ?? res.statusText
      );
      process.exit(1);
    }

    if (!data.access_token || !data.refresh_token || !data.open_id) {
      console.error("\nERROR: Unexpected response — missing tokens:", JSON.stringify(data));
      process.exit(1);
    }

    console.log("\n─────────────────────────────────────────────────────────────");
    console.log("SUCCESS! Add these to your .env file:\n");
    console.log(`TIKTOK_ACCESS_TOKEN=${data.access_token}`);
    console.log(`TIKTOK_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`TIKTOK_OPEN_ID=${data.open_id}`);
    console.log(`\n# Access token expires in: ${Math.round((data.expires_in ?? 0) / 3600)}h`);
    console.log(`# Refresh token expires in: ${Math.round((data.refresh_expires_in ?? 0) / 86400)} days`);
    console.log(`# Scopes granted: ${data.scope ?? SCOPES}`);
    console.log("─────────────────────────────────────────────────────────────\n");
  } catch (err) {
    console.error("\nERROR:", err);
    process.exit(1);
  }
});
