import { NextRequest, NextResponse } from "next/server";

/**
 * POST /auth/callback
 *
 * TikTok webhook verification endpoint.
 *
 * TikTok sends a verification request with a challenge parameter.
 * We must echo back the challenge to confirm the endpoint is valid.
 *
 * Verification request format:
 *   POST /auth/callback/
 *   Body: { challenge: "some_random_string" }
 *
 * Expected response:
 *   200 { challenge: "some_random_string" }
 *
 * After verification, TikTok will send event notifications to this endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verification challenge
    if (body.challenge) {
      console.log("[tiktok-webhook] Received verification challenge:", body.challenge);
      return NextResponse.json({ challenge: body.challenge });
    }

    // Event notification
    console.log("[tiktok-webhook] Received event notification:", body);

    // TODO: Process TikTok event notifications here
    // Common events:
    //   - video.publish.complete
    //   - video.publish.failed
    //   - comment.created
    //   - etc.

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[tiktok-webhook] Error processing webhook:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /auth/callback
 *
 * Optional: Handle OAuth callback from TikTok
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("[tiktok-oauth] Authorization error:", error);
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  console.log("[tiktok-oauth] Received authorization code:", code.substring(0, 10) + "...");
  console.log("[tiktok-oauth] State:", state);

  // TODO: Exchange code for access token
  // See: https://developers.tiktok.com/doc/oauth-user-access-token-management

  return NextResponse.json({
    message: "OAuth callback received. TODO: Exchange code for token.",
    code: code.substring(0, 10) + "...",
    state,
  });
}
