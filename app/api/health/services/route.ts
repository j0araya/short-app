/**
 * GET /api/health/services[?service=worker|mongodb|ollama|youtube|tiktok|instagram]
 *
 * Without ?service — returns all checks in parallel (polling mode).
 * With ?service=X  — runs only that check and returns its result (on-demand revalidation).
 *
 * Response shape (all):
 *   { mongodb, ollama, youtube, tiktok, instagram }
 *
 * Response shape (single):
 *   { [service]: ServiceStatus }
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── MongoDB ───────────────────────────────────────────────────────────────────

async function checkMongo(): Promise<{ ok: boolean; latencyMs?: number }> {
  try {
    const t0 = Date.now();
    await connectDB();
    // readyState 1 = connected
    if (mongoose.connection.readyState !== 1) {
      return { ok: false };
    }
    // Ping the server directly — fails fast if Atlas is unreachable
    await mongoose.connection.db?.command({ ping: 1 });
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch {
    return { ok: false };
  }
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async function checkOllama(): Promise<{ ok: boolean; model?: string; latencyMs?: number }> {
  const base = process.env.OLLAMA_BASE_URL?.replace("/v1", "") ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "gemma3:4b";

  try {
    const t0 = Date.now();
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json() as { models?: { name: string }[] };
    const latencyMs = Date.now() - t0;

    // Check if the expected model is loaded
    const loaded = data.models?.some((m) => m.name === model) ?? false;
    return { ok: loaded, model: loaded ? model : undefined, latencyMs };
  } catch {
    return { ok: false };
  }
}

// ── YouTube ───────────────────────────────────────────────────────────────────

async function checkYouTube(): Promise<{ ok: boolean; configured: boolean }> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  const configured = Boolean(YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && YOUTUBE_REFRESH_TOKEN);
  if (!configured) return { ok: false, configured: false };

  try {
    // Lazy import to avoid loading googleapis on every request unnecessarily
    const { google } = await import("googleapis");
    const auth = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });

    // getAccessToken() attempts a token refresh — this is the cheapest real auth check
    const tokenRes = await Promise.race([
      auth.getAccessToken(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      ),
    ]);

    return { ok: Boolean((tokenRes as { token?: string }).token), configured: true };
  } catch {
    return { ok: false, configured: true };
  }
}

// ── TikTok ────────────────────────────────────────────────────────────────────

async function checkTikTok(): Promise<{ ok: boolean; configured: boolean }> {
  const {
    TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET,
    TIKTOK_ACCESS_TOKEN,
    TIKTOK_REFRESH_TOKEN,
    TIKTOK_OPEN_ID,
  } = process.env;

  const configured = Boolean(
    TIKTOK_CLIENT_KEY &&
      TIKTOK_CLIENT_SECRET &&
      TIKTOK_ACCESS_TOKEN &&
      TIKTOK_REFRESH_TOKEN &&
      TIKTOK_OPEN_ID
  );

  // TikTok token refresh is expensive (~network round-trip + rate-limit risk).
  // For the health sidebar we only report "configured" vs "not configured".
  return { ok: configured, configured };
}

// ── Instagram ─────────────────────────────────────────────────────────────────

async function checkInstagram(): Promise<{ ok: boolean; configured: boolean }> {
  const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID } = process.env;
  const configured = Boolean(INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_BUSINESS_ACCOUNT_ID);
  return { ok: configured, configured };
}

// ── Handler ───────────────────────────────────────────────────────────────────

const CHECKERS = {
  mongodb: checkMongo,
  ollama: checkOllama,
  youtube: checkYouTube,
  tiktok: checkTikTok,
  instagram: checkInstagram,
} as const;

type ServiceKey = keyof typeof CHECKERS;

export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service") as ServiceKey | null;

  // Single-service revalidation
  if (service && service in CHECKERS) {
    const result = await CHECKERS[service]();
    return NextResponse.json({ [service]: result });
  }

  // Full check (polling mode)
  const [mongodb, ollama, youtube, tiktok, instagram] = await Promise.all([
    checkMongo(),
    checkOllama(),
    checkYouTube(),
    checkTikTok(),
    checkInstagram(),
  ]);

  return NextResponse.json({ mongodb, ollama, youtube, tiktok, instagram });
}
