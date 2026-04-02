/**
 * lib/adapters/leonardo.ts
 *
 * Leonardo.ai REST API adapter for video generation.
 *
 * Supports:
 *   - Text-to-video via Motion 2.0 (no image required, 9:16 native)
 *   - Webhook callback for async completion
 *   - Polling fallback when webhook is not available
 *
 * Required env vars:
 *   LEONARDO_API_KEY   — Leonardo.ai production API key
 *   NEXT_PUBLIC_APP_URL — Public URL of this app (e.g. https://yourapp.com)
 *                         Used as the webhook callback base URL.
 */

import fs from "fs";

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 min

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeonardoTextToVideoParams {
  prompt: string;
  /** 9:16 vertical by default (480 wide × 832 tall → outputs 720×1280 at 720p) */
  width?: number;
  height?: number;
  /** "RESOLUTION_480" | "RESOLUTION_720" */
  resolution?: string;
  duration?: 4 | 5 | 8 | 10;
  frameInterpolation?: boolean;
  promptEnhance?: boolean;
  /** Optional webhook URL. If omitted, no webhook is sent by Leonardo. */
  webhookCallbackUrl?: string;
}

export interface LeonardoGenerationResult {
  /** Leonardo generation ID */
  generationId: string;
  /** Direct URL to the generated MP4 (available after completion) */
  videoUrl: string;
}

export interface LeonardoWebhookPayload {
  type: string; // "video_generation.complete"
  object: string;
  timestamp: number;
  api_version: string;
  data: {
    object: {
      id: string;
      status: "COMPLETE" | "FAILED" | string;
      videoUrl?: string;
      motionMP4URL?: string;
      videos?: Array<{ url: string }>;
      generated_videos?: Array<{ url: string }>;
      prompt?: string;
    };
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) throw new Error("LEONARDO_API_KEY is not set");
  return key;
}

async function leonardoFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${LEONARDO_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "authorization": `Bearer ${getApiKey()}`,
      ...(options.headers ?? {}),
    },
  });
  return res;
}

// ── Text-to-video (Motion 2.0) ────────────────────────────────────────────────

/**
 * Starts a text-to-video generation and returns the Leonardo generation ID.
 *
 * If `webhookCallbackUrl` is provided in params, Leonardo will POST the result
 * to that URL when done. Otherwise use `pollUntilComplete` to wait.
 */
export async function startTextToVideo(
  params: LeonardoTextToVideoParams
): Promise<string> {
   const body = {
     prompt:             params.prompt,
     width:              params.width  ?? 480,
     height:             params.height ?? 832,
     resolution:         params.resolution ?? "RESOLUTION_720",
     frameInterpolation: params.frameInterpolation ?? true,
     isPublic:           false,
     promptEnhance:      params.promptEnhance ?? true,
   };

  const res = await leonardoFetch("/generations-text-to-video", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Leonardo text-to-video start failed (${res.status}): ${errText.slice(0, 300)}`
    );
  }

   const data = await res.json() as {
     videoGenerationJob?: { generationId?: string };
     motionVideoGenerationJob?: { generationId?: string };
     generationId?: string;
   };

   const generationId =
     data.motionVideoGenerationJob?.generationId ??
     data.videoGenerationJob?.generationId ??
     data.generationId;

  if (!generationId) {
    throw new Error(
      `Leonardo response missing generationId: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  return generationId;
}

// ── Polling ───────────────────────────────────────────────────────────────────

/**
 * Polls Leonardo until the generation is COMPLETE (or throws on timeout/error).
 * Returns the direct video URL.
 */
export async function pollUntilComplete(
  generationId: string
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (true) {
    if (Date.now() > deadline) {
      throw new Error(
        `Leonardo generation ${generationId} timed out after ${POLL_TIMEOUT_MS / 1_000}s`
      );
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await leonardoFetch(`/generations-text-to-video/${generationId}`);

    if (!res.ok) {
      console.warn(`[leonardo] Poll non-ok (${res.status}), retrying…`);
      continue;
    }

    const data = await res.json() as {
      status?: string;
      videoUrl?: string;
      videos?: Array<{ url: string }>;
      generated_videos?: Array<{ url: string }>;
    };

    if (data.status === "FAILED") {
      throw new Error(`Leonardo generation ${generationId} failed`);
    }

    if (data.status === "COMPLETE") {
      const url =
        data.videoUrl ??
        data.videos?.[0]?.url ??
        data.generated_videos?.[0]?.url;

      if (!url) {
        throw new Error(
          `Leonardo generation COMPLETE but no videoUrl found: ${JSON.stringify(data).slice(0, 200)}`
        );
      }
      return url;
    }

    console.log(`[leonardo] Generation ${generationId} still ${data.status ?? "processing"}…`);
  }
}

// ── Video download ────────────────────────────────────────────────────────────

/**
 * Downloads a video from a URL and writes it to `outputPath`.
 */
export async function downloadVideo(
  videoUrl: string,
  outputPath: string
): Promise<void> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download Leonardo video (${res.status}): ${videoUrl}`
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buf);
  console.log(
    `[leonardo] Video downloaded to ${outputPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`
  );
}

// ── Extract video URL from webhook payload ────────────────────────────────────

/**
 * Extracts the video URL from a Leonardo webhook payload.
 * Returns null if the generation failed or no URL is present.
 */
export function extractVideoUrlFromWebhook(
  payload: LeonardoWebhookPayload
): string | null {
  const obj = payload.data?.object;
  if (!obj) return null;
  if (obj.status !== "COMPLETE") return null;

  return (
    obj.videoUrl ??
    obj.motionMP4URL ??
    obj.videos?.[0]?.url ??
    obj.generated_videos?.[0]?.url ??
    null
  );
}
