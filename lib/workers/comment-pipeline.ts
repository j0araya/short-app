/**
 * comment-pipeline.ts
 *
 * Comment-driven video generation pipeline.
 *
 * Flow:
 *   1. Fetch the top-5 most-liked comments from a published YouTube video
 *   2. Send those comments to Gemini 1.5 Flash to extract creative attributes:
 *        action, background, style, musicMood, videoPrompt
 *   3. Search YouTube Data API for a royalty-free Audio Library track matching the mood
 *   4. Generate a short video using Veo (via Gemini API) from the video prompt
 *   5. Upload the result to Google Drive → shorts/YYYY-MM-DD/<platform>/
 *   6. Create a Video document (pending_publish) so it appears in the review page
 *
 * Deduplication: a commentsHash prevents the same comment set from generating twice.
 *
 * Required env vars:
 *   GEMINI_API_KEY           — Google AI Studio API key (Gemini + Veo access)
 *   YOUTUBE_CLIENT_ID        — existing YouTube OAuth2 credentials
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { connectDB, Video, CommentJob, ActivityEvent } from "@/lib/db";
import type { IVideoAttributes } from "@/lib/db/models/CommentJob";
import { getYouTubeClient } from "@/lib/adapters/youtube-auth";
import { uploadToDrive } from "@/lib/drive/upload";
import { generateAICaption } from "@/lib/workers/ai-caption";
import {
  generateYouTubeDescription,
  generateYouTubeHashtags,
  generateTikTokDescription,
  generateTikTokHashtags,
  generateInstagramCaption,
  generateInstagramHashtags,
} from "@/lib/workers/caption-gen";

// ── Constants ─────────────────────────────────────────────────────────────────

const TMP_DIR = "/tmp/short-app/comment-gen";

// Fetch enough comments to have a good chance of finding at least one
// winner per category even if most comments don't use hashtags.
const VOTE_COMMENT_POOL = 100;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureTmpDir(): void {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

function hashComments(comments: string[]): string {
  const sorted = [...comments].sort().join("\n");
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

// ── Step 1: Fetch comments with like counts from YouTube ─────────────────────
// We fetch a larger pool (up to 100) ordered by relevance (most-liked first)
// so we can find the top-liked comment per hashtag category.

export interface CommentWithLikes {
  text: string;
  likeCount: number;
}

export async function fetchCommentsWithLikes(
  videoId: string,
  maxResults = VOTE_COMMENT_POOL
): Promise<CommentWithLikes[]> {
  const yt = getYouTubeClient();

  const res = await yt.commentThreads.list({
    part: ["snippet"],
    videoId,
    order: "relevance",   // most-liked first
    maxResults,
    textFormat: "plainText",
  });

  const items = res.data.items ?? [];
  return items
    .map((item) => ({
      text:      item.snippet?.topLevelComment?.snippet?.textDisplay ?? "",
      likeCount: item.snippet?.topLevelComment?.snippet?.likeCount   ?? 0,
    }))
    .filter((c) => c.text.length > 0);
}

// ── Step 2: Vote-based attribute extraction ───────────────────────────────────
//
// Each comment can vote for one category by including a hashtag:
//   #background  — scene / location idea
//   #style       — visual style (cinematic, anime, minimalistic, etc.)
//   #actions     — subject action for the video
//   #music       — song reference (legal YouTube Audio Library track)
//
// Rules:
//   - A comment matches a category if its text contains the hashtag (case-insensitive).
//   - If multiple comments match the same category, the one with the most likes wins.
//   - If two comments tie on likes, the first one in the API response wins (already
//     ordered by relevance/likes by YouTube).
//   - If no comment exists for a category, Gemini fills in a sensible default
//     using the winning comments from the other categories as context.
//   - musicMood is derived from the #music comment (song title used as search query).

const VOTE_HASHTAGS = {
  background: /#background\b/i,
  style:      /#style\b/i,
  action:     /#actions?\b/i,
  music:      /#music\b/i,
} as const;

export interface VoteWinners {
  background: CommentWithLikes | null;
  style:      CommentWithLikes | null;
  action:     CommentWithLikes | null;
  music:      CommentWithLikes | null;
}

export function pickVoteWinners(comments: CommentWithLikes[]): VoteWinners {
  const winners: VoteWinners = { background: null, style: null, action: null, music: null };

  for (const [category, pattern] of Object.entries(VOTE_HASHTAGS) as [keyof VoteWinners, RegExp][]) {
    const candidates = comments.filter((c) => pattern.test(c.text));
    if (candidates.length === 0) continue;

    // Sort by likes desc — if tied, first in array wins (YouTube already orders by relevance)
    candidates.sort((a, b) => b.likeCount - a.likeCount);
    winners[category] = candidates[0];
  }

  return winners;
}

/** Strips the hashtag prefix and surrounding whitespace from a winning comment. */
function extractVoteContent(text: string, hashtag: RegExp): string {
  return text.replace(hashtag, "").trim();
}

/** Derives a music search query from a #music comment.
 *  e.g. "Linkin Park - In The End" → "Linkin Park In The End"
 */
function extractMusicQuery(text: string): string {
  return extractVoteContent(text, VOTE_HASHTAGS.music)
    .replace(/[[\]()]/g, " ")   // remove brackets like "[important use legal music references]"
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Step 2b: Fill missing categories with Gemini ─────────────────────────────
// If one or more categories have no vote winner, Gemini fills them in using
// the winning comments from the other categories as creative context.

const FILL_PROMPT = (
  winners: VoteWinners,
  missingCategories: string[]
) => `
You are a creative director for short-form social media videos.

The audience voted on the following creative attributes for the next video:
${winners.background ? `- Background / scene: "${extractVoteContent(winners.background.text, VOTE_HASHTAGS.background)}" (${winners.background.likeCount} likes)` : ""}
${winners.style      ? `- Visual style: "${extractVoteContent(winners.style.text, VOTE_HASHTAGS.style)}" (${winners.style.likeCount} likes)` : ""}
${winners.action     ? `- Action / subject: "${extractVoteContent(winners.action.text, VOTE_HASHTAGS.action)}" (${winners.action.likeCount} likes)` : ""}

The following categories had no votes and need to be filled in: ${missingCategories.join(", ")}.

Based on the voted attributes above, generate ONLY the missing fields. Keep them consistent with the voted style and mood.

Respond ONLY with a JSON object (no markdown, no explanation) containing only these keys: ${missingCategories.map((k) => `"${k}"`).join(", ")}.
Each value should be a short, vivid description (1 sentence max).
`;

export async function fillMissingAttributesWithGemini(
  winners: VoteWinners
): Promise<Pick<IVideoAttributes, "action" | "background" | "style" | "videoPrompt">> {
  const missing: Array<"action" | "background" | "style"> = [];
  if (!winners.action)     missing.push("action");
  if (!winners.background) missing.push("background");
  if (!winners.style)      missing.push("style");

  // Always generate videoPrompt from Gemini — it synthesizes all attributes
  const alwaysMissing = ["videoPrompt"] as const;

  const allMissing = [...missing, ...alwaysMissing];

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(FILL_PROMPT(winners, allMissing));
  const text = result.response.text().trim();
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: Partial<Record<string, string>>;
  try {
    parsed = JSON.parse(clean) as Partial<Record<string, string>>;
  } catch {
    throw new Error(`Gemini returned invalid JSON for fill: ${text.slice(0, 200)}`);
  }

  const action     = winners.action
    ? extractVoteContent(winners.action.text, VOTE_HASHTAGS.action)
    : (parsed["action"] ?? "");
  const background = winners.background
    ? extractVoteContent(winners.background.text, VOTE_HASHTAGS.background)
    : (parsed["background"] ?? "");
  const style      = winners.style
    ? extractVoteContent(winners.style.text, VOTE_HASHTAGS.style)
    : (parsed["style"] ?? "");
  const videoPrompt = parsed["videoPrompt"] ?? "";

  if (!action || !background || !style || !videoPrompt) {
    throw new Error(`Could not resolve all attributes. Parsed: ${JSON.stringify(parsed)}`);
  }

  return { action, background, style, videoPrompt };
}

// ── Step 2c: Assemble final IVideoAttributes from vote winners ────────────────

export async function extractAttributesByVote(
  comments: CommentWithLikes[]
): Promise<IVideoAttributes> {
  const winners = pickVoteWinners(comments);

  console.log(`[comment-pipeline] Vote winners:`, {
    background: winners.background ? `"${winners.background.text.slice(0, 60)}" (${winners.background.likeCount} likes)` : "none",
    style:      winners.style      ? `"${winners.style.text.slice(0, 60)}" (${winners.style.likeCount} likes)` : "none",
    action:     winners.action     ? `"${winners.action.text.slice(0, 60)}" (${winners.action.likeCount} likes)` : "none",
    music:      winners.music      ? `"${winners.music.text.slice(0, 60)}" (${winners.music.likeCount} likes)` : "none",
  });

  const { action, background, style, videoPrompt } = await fillMissingAttributesWithGemini(winners);

  // musicMood: use the #music comment as the Audio Library search query,
  // falling back to derivation from style if no music vote exists.
  const musicMood = winners.music
    ? extractMusicQuery(winners.music.text)
    : deriveMusicMoodFromStyle(style);

  return { action, background, style, musicMood, videoPrompt };
}

/** Derives a music mood for the Audio Library search from the visual style. */
function deriveMusicMoodFromStyle(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("cinematic") || s.includes("epic"))                          return "epic orchestral";
  if (s.includes("anime") || s.includes("animation"))                         return "upbeat electronic";
  if (s.includes("retro") || s.includes("80s") || s.includes("vhs"))         return "synthwave retro";
  if (s.includes("documentary") || s.includes("realist"))                     return "ambient documentary";
  if (s.includes("lo-fi") || s.includes("lofi"))                              return "chill lo-fi";
  if (s.includes("dark") || s.includes("noir"))                               return "dark atmospheric";
  if (s.includes("futuristic") || s.includes("sci-fi") || s.includes("scifi")) return "futuristic electronic";
  if (s.includes("minimalist") || s.includes("clean"))                        return "minimal ambient";
  if (s.includes("comic") || s.includes("cartoon"))                           return "fun upbeat";
  return "upbeat tech electronic";
}

// ── Step 2b: Validate attributes against platform content policies ────────────
//
// Checks that Gemini-generated attributes comply with:
//   - YouTube Community Guidelines
//   - TikTok Community Guidelines (effective Sept 2025)
//   - Google Veo 2 Responsible AI / Prohibited Use Policy
//
// Three violation tiers:
//   HARD  — blocks Veo at generation time (real people, CSAM, explicit, hate)
//   SOFT  — platform suppression risk (violent framing, aggressive music moods)
//   BRAND — copyright / impersonation risk (real org names, artist styles)
//
// Throws PolicyViolationError with a human-readable reason on any HARD match.
// Logs warnings for SOFT/BRAND violations (non-fatal, but recorded).

export class PolicyViolationError extends Error {
  constructor(
    public readonly field: string,
    public readonly tier: "hard" | "soft" | "brand",
    public readonly reason: string
  ) {
    super(`[policy:${tier}] ${field}: ${reason}`);
    this.name = "PolicyViolationError";
  }
}

// Real person/celebrity name patterns — Veo Celebrity filter rejects these
const REAL_PERSON_PATTERN =
  /\b(elon\s*musk|sam\s*altman|tim\s*cook|mark\s*zuckerberg|sundar\s*pichai|satya\s*nadella|jeff\s*bezos|bill\s*gates|linus\s*torvalds|trump|biden|obama|putin|modi|xi\s*jinping|jensen\s*huang)\b/i;

// Real news org / brand impersonation — triggers Veo third-party content guardrail
const REAL_ORG_PATTERN =
  /\b(cnn|bbc|nbc|abc\s*news|fox\s*news|msnbc|reuters|associated\s*press|new\s*york\s*times|washington\s*post|the\s*verge|techcrunch|wired|bloomberg)\b/i;

// Sexual content — hard block on all platforms and Veo
const SEXUAL_PATTERN =
  /\b(nude|naked|pornograph|sexual|nsfw|explicit\s*content|erotic|undressed|strip(?:per|tease)?|orgasm|genitals?|breast(?:s)?\s+exposed)\b/i;

// Violence framing that shocks/glorifies — YouTube + Veo Violence filter
const HARD_VIOLENCE_PATTERN =
  /\b(gore|torture|execution|beheading|massacre|mutilat|dismember|stabbing|shoot(?:ing)?\s+(?:a\s+)?(?:person|human|man|woman|child)|suicide\s+method|self[\s-]harm\s+instruction)\b/i;

// Hate speech / supremacy — all platforms hard block
const HATE_PATTERN =
  /\b(subhuman|racial\s*superiority|white\s*suprem|ethnic\s*cleansing|genocide\s*is|holocaust\s*(?:denial|fake|didn.t)|(?:jews?|muslims?|christians?|blacks?|whites?|asians?)\s+(?:are\s+)?(?:evil|inferior|vermin|parasites?))\b/i;

// Minors in any suggestive or dangerous context — absolute block everywhere
const MINORS_PATTERN =
  /\b(child(?:ren)?\s+(?:nude|naked|sexual|explicit)|minor\s+(?:nude|explicit|sexual)|underage\s+(?:nude|explicit))\b/i;

// Soft: violent framing in tech context — Veo may partially block, platform FYF suppression
const SOFT_VIOLENCE_PATTERN =
  /\b(robot\s+attack(?:s|ing)?|ai\s+(?:kills?|destroys?|attacks?)\s+human|hacker\s+destroys?|drone\s+strikes?|cyber\s*attack\s+destroy|bomb(?:ing)?\s+(?:server|data\s*center))\b/i;

// Soft: aggressive music mood — TikTok FYF suppression risk
const SOFT_MUSIC_PATTERN =
  /\b(aggressive\s+(?:attack|violence|war)|dark\s+violent|menacing\s+attack|death\s+metal\s+gore)\b/i;

// Brand: artist style impersonation in musicMood — copyright signal
const BRAND_MUSIC_PATTERN =
  /\b(sound(?:s)?\s+like\s+\w+|in\s+the\s+style\s+of\s+(?:daft\s*punk|the\s+weeknd|taylor\s+swift|beyoncé|drake|kendrick|eminem|billie\s+eilish))\b/i;

interface PolicyCheck {
  field: keyof IVideoAttributes;
  value: string;
}

export function validateAttributes(attrs: IVideoAttributes): void {
  const checks: PolicyCheck[] = [
    { field: "action",      value: attrs.action },
    { field: "background",  value: attrs.background },
    { field: "style",       value: attrs.style },
    { field: "musicMood",   value: attrs.musicMood },
    { field: "videoPrompt", value: attrs.videoPrompt },
  ];

  for (const { field, value } of checks) {
    // ── HARD violations — throw immediately ──────────────────────────────────

    if (MINORS_PATTERN.test(value)) {
      throw new PolicyViolationError(field, "hard",
        "content involving minors in a suggestive or dangerous context is prohibited on all platforms and by Veo");
    }

    if (SEXUAL_PATTERN.test(value)) {
      throw new PolicyViolationError(field, "hard",
        "sexually explicit content is prohibited by YouTube, TikTok, and rejected by Veo safety filters");
    }

    if (HATE_PATTERN.test(value)) {
      throw new PolicyViolationError(field, "hard",
        "hate speech or supremacist content is prohibited on all platforms");
    }

    if (HARD_VIOLENCE_PATTERN.test(value)) {
      throw new PolicyViolationError(field, "hard",
        "graphic violent content (gore, torture, execution) is prohibited on YouTube and TikTok and triggers Veo Violence filter");
    }

    if (REAL_PERSON_PATTERN.test(value)) {
      throw new PolicyViolationError(field, "hard",
        "photorealistic depictions of named real individuals are blocked by Veo's Celebrity filter and violate YouTube/TikTok impersonation policies");
    }

    if (REAL_ORG_PATTERN.test(value)) {
      throw new PolicyViolationError(field, "hard",
        "mimicking real news organizations triggers Veo's third-party content guardrail and constitutes platform misinformation risk");
    }

    // ── SOFT violations — log warning, do not throw ──────────────────────────

    if (SOFT_VIOLENCE_PATTERN.test(value)) {
      console.warn(
        `[policy:soft] ${field}: violent tech framing detected ("${value.slice(0, 80)}") — ` +
        "may partially trigger Veo Violence filter and cause TikTok FYF suppression"
      );
    }

    if (field === "musicMood" && SOFT_MUSIC_PATTERN.test(value)) {
      console.warn(
        `[policy:soft] musicMood: aggressive mood framing ("${value.slice(0, 80)}") — ` +
        "may cause TikTok FYF suppression"
      );
    }

    if (field === "musicMood" && BRAND_MUSIC_PATTERN.test(value)) {
      console.warn(
        `[policy:brand] musicMood: artist style impersonation detected ("${value.slice(0, 80)}") — ` +
        "copyright signal on YouTube and TikTok"
      );
    }
  }
}

// ── Step 3: Search YouTube Audio Library ─────────────────────────────────────
// The YouTube Data API doesn't expose the Audio Library directly, so we search
// YouTube for "site:studio.youtube.com" equivalent tracks using the public
// youtube#video search restricted to the official "YouTube Audio Library" channel.
// Channel ID: UCVMZcF6O5_Q_fSBOe2UaAiA (YouTube Audio Library official)

const YT_AUDIO_LIBRARY_CHANNEL = "UCVMZcF6O5_Q_fSBOe2UaAiA";

export async function searchAudioLibraryTrack(musicMood: string): Promise<{
  title: string;
  artist: string;
  youtubeUrl: string;
  mood: string;
} | null> {
  try {
    const yt = getYouTubeClient();

    const res = await yt.search.list({
      part: ["snippet"],
      q: musicMood,
      channelId: YT_AUDIO_LIBRARY_CHANNEL,
      type: ["video"],
      maxResults: 5,
      videoDuration: "short",
    });

    const items = res.data.items ?? [];
    if (items.length === 0) return null;

    const first = items[0];
    const videoId = first.id?.videoId;
    if (!videoId) return null;

    const title  = first.snippet?.title ?? "Unknown track";
    const artist = first.snippet?.channelTitle ?? "YouTube Audio Library";

    return {
      title,
      artist,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      mood: musicMood,
    };
  } catch (err) {
    // Non-fatal — music metadata is informational, not required for the video
    console.warn("[comment-pipeline] Audio Library search failed:", err);
    return null;
  }
}

// ── Step 4: Generate video with Veo ──────────────────────────────────────────
// Veo 2 is available through the Gemini API as a long-running operation.
// We poll until the operation completes or times out.

const VEO_MODEL = "veo-2.0-generate-001";
const VEO_POLL_INTERVAL_MS = 5_000;
const VEO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function generateVideoWithVeo(
  videoPrompt: string,
  outputPath: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  // Veo is accessed via the REST API directly (not yet in the JS SDK stable)
  const baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  // 1. Start the generation operation
  const startRes = await fetch(
    `${baseUrl}/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [
          {
            prompt: videoPrompt,
          },
        ],
        parameters: {
          aspectRatio: "9:16",
          durationSeconds: 8,
          numberOfVideos: 1,
        },
      }),
    }
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Veo start failed (${startRes.status}): ${errText.slice(0, 300)}`);
  }

  const operation = await startRes.json() as { name: string; done?: boolean };
  const operationName = operation.name;
  console.log(`[comment-pipeline] Veo operation started: ${operationName}`);

  // 2. Poll until done
  const deadline = Date.now() + VEO_TIMEOUT_MS;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) {
      throw new Error(`Veo operation timed out after ${VEO_TIMEOUT_MS / 1000}s`);
    }

    await new Promise((r) => setTimeout(r, VEO_POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `${baseUrl}/${operationName}?key=${apiKey}`,
      { method: "GET" }
    );

    if (!pollRes.ok) {
      console.warn(`[comment-pipeline] Veo poll non-ok (${pollRes.status}), retrying…`);
      continue;
    }

    const status = await pollRes.json() as {
      done?: boolean;
      error?: { message: string };
      response?: {
        predictions?: Array<{
          bytesBase64Encoded?: string;
          mimeType?: string;
          videoUri?: string;
        }>;
      };
    };

    if (status.error) {
      throw new Error(`Veo generation error: ${status.error.message}`);
    }

    if (!status.done) {
      console.log(`[comment-pipeline] Veo still processing…`);
      continue;
    }

    // Done — extract video bytes
    const predictions = status.response?.predictions ?? [];
    const prediction = predictions[0];

    if (!prediction) {
      throw new Error("Veo returned no predictions");
    }

    if (prediction.bytesBase64Encoded) {
      // Inline base64 video
      const buf = Buffer.from(prediction.bytesBase64Encoded, "base64");
      fs.writeFileSync(outputPath, buf);
      console.log(`[comment-pipeline] Veo video written to ${outputPath} (${buf.length} bytes)`);
      return outputPath;
    }

    if (prediction.videoUri) {
      // Download from GCS URI
      const dlRes = await fetch(prediction.videoUri);
      if (!dlRes.ok) {
        throw new Error(`Failed to download Veo video from URI (${dlRes.status})`);
      }
      const buf = Buffer.from(await dlRes.arrayBuffer());
      fs.writeFileSync(outputPath, buf);
      console.log(`[comment-pipeline] Veo video downloaded to ${outputPath} (${buf.length} bytes)`);
      return outputPath;
    }

    throw new Error("Veo prediction has neither bytesBase64Encoded nor videoUri");
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export interface CommentPipelineResult {
  commentJobId: string;
  videoId: string;
  driveWebViewLink: string;
  attributes: IVideoAttributes;
}

/**
 * Runs the full comment-driven pipeline for a single published video.
 *
 * @param sourceYouTubeId  YouTube video ID, e.g. "dQw4w9WgXcQ"
 * @param sourceVideoDocId MongoDB Video._id of the source video (optional, for linking)
 * @param platform         Platform to tag the output video for, e.g. "youtube"
 */
export async function runCommentPipeline(
  sourceYouTubeId: string,
  sourceVideoDocId: string | null,
  platform = "youtube"
): Promise<CommentPipelineResult> {
  await connectDB();
  ensureTmpDir();

  // ── 1. Fetch comments with like counts ───────────────────────────────────
  console.log(`[comment-pipeline] Fetching up to ${VOTE_COMMENT_POOL} comments for ${sourceYouTubeId}`);
  const commentsWithLikes = await fetchCommentsWithLikes(sourceYouTubeId, VOTE_COMMENT_POOL);

  if (commentsWithLikes.length === 0) {
    throw new Error(`No comments found for YouTube video ${sourceYouTubeId}`);
  }

  console.log(`[comment-pipeline] Got ${commentsWithLikes.length} comments`);

  // ── 2. Dedup check ────────────────────────────────────────────────────────
  const comments = commentsWithLikes.map((c) => c.text);
  const commentsHash = hashComments(comments);

  const existing = await CommentJob.findOne({
    sourceVideoId: sourceYouTubeId,
    commentsHash,
  }).lean();

  if (existing && existing.status !== "failed") {
    throw new Error(
      `Already processed this comment set (hash ${commentsHash}, job ${existing._id})`
    );
  }

  // ── 3. Create CommentJob record ───────────────────────────────────────────
  const commentJob = await CommentJob.findOneAndUpdate(
    { sourceVideoId: sourceYouTubeId, commentsHash },
    {
      $setOnInsert: {
        sourceVideoId: sourceYouTubeId,
        sourceVideoDocId: sourceVideoDocId ?? null,
        comments,
        commentsHash,
        status: "processing",
      },
      $set: { status: "processing", errorMsg: null },
    },
    { upsert: true, new: true }
  );

  try {
    // ── 4. Extract attributes via vote winners + Gemini fill ────────────────
    console.log(`[comment-pipeline] Extracting attributes from vote winners…`);
    const attributes = await extractAttributesByVote(commentsWithLikes);

    await CommentJob.findByIdAndUpdate(commentJob._id, { attributes });
    console.log(`[comment-pipeline] Attributes:`, attributes);

    // ── 4b. Validate attributes against platform content policies ───────────
    validateAttributes(attributes);

    // ── 5. Search music ─────────────────────────────────────────────────────
    console.log(`[comment-pipeline] Searching YouTube Audio Library for "${attributes.musicMood}"…`);
    const music = await searchAudioLibraryTrack(attributes.musicMood);

    if (music) {
      await CommentJob.findByIdAndUpdate(commentJob._id, { music });
      console.log(`[comment-pipeline] Music: ${music.title} by ${music.artist}`);
    } else {
      console.log(`[comment-pipeline] No music found (non-fatal)`);
    }

    // ── 6. Generate video with Veo ──────────────────────────────────────────
    const outputPath = path.join(TMP_DIR, `${String(commentJob._id)}.mp4`);
    console.log(`[comment-pipeline] Generating video with Veo…`);
    console.log(`[comment-pipeline] Prompt: ${attributes.videoPrompt}`);

    await generateVideoWithVeo(attributes.videoPrompt, outputPath);
    await CommentJob.findByIdAndUpdate(commentJob._id, { videoPath: outputPath });

    // ── 7. Generate AI caption for the video ───────────────────────────────
    const captionTitle = `${attributes.action} — ${attributes.style}`;

    // Attribute block with icons — appended to every platform description
    // so viewers know what community signals drove this video.
    const attributeLines = [
      `🏞️  ${attributes.background}`,
      `🎨 ${attributes.style}`,
      `💡 ${attributes.videoPrompt}`,
      ...(music ? [`🎵 ${music.title}`] : []),
    ].join("\n");

    const youtubeBaseDesc   = generateYouTubeDescription(captionTitle);
    const tiktokBaseDesc    = generateTikTokDescription(captionTitle);
    const instagramBaseDesc = generateInstagramCaption(captionTitle);

    // Optionally enrich description with AI if Ollama is available
    const aiResult = await generateAICaption(captionTitle, null).catch(() => null);

    const youtubeDescription = [
      aiResult?.description ?? youtubeBaseDesc,
      "",
      attributeLines,
    ].join("\n");

    const tiktokDescription = [
      aiResult?.description ?? tiktokBaseDesc,
      "",
      attributeLines,
    ].join("\n");

    const instagramCaption = [
      aiResult?.description ?? instagramBaseDesc,
      "",
      attributeLines,
    ].join("\n");

    const youtubeHashtags  = generateYouTubeHashtags(captionTitle);
    const tiktokHashtags   = generateTikTokHashtags(captionTitle);
    const instagramHashtags = generateInstagramHashtags(captionTitle);

    // ── 8. Upload to Drive ──────────────────────────────────────────────────
    console.log(`[comment-pipeline] Uploading to Drive…`);
    const driveResult = await uploadToDrive(outputPath, platform, captionTitle);

    await CommentJob.findByIdAndUpdate(commentJob._id, {
      driveFileId:    driveResult.fileId,
      driveFolderId:  driveResult.folderId,
      driveWebViewLink: driveResult.webViewLink,
    });

    // ── 9. Create Video document ────────────────────────────────────────────
    // We create a synthetic Job-less Video. We reuse the Video model but set
    // jobId to a self-referencing ObjectId placeholder so it satisfies the
    // required field — the CommentJob is the real source of truth.
    // We store sourceArticleUrl as the YouTube source video URL for reference.
    const outputVideo = await Video.create({
      jobId:              commentJob._id,   // points to CommentJob (same ObjectId shape)
      title:              captionTitle,
      platform,
      contentType:        "short_video",
      publishStatus:      "pending_publish",
      sourceArticleUrl:   `https://www.youtube.com/watch?v=${sourceYouTubeId}`,
      hasVideo:           true,
      youtubeDescription,
      youtubeHashtags,
      tiktokDescription,
      tiktokHashtags,
      instagramCaption,
      instagramHashtags,
      driveFileId:        driveResult.fileId,
      driveFolderId:      driveResult.folderId,
      driveWebViewLink:   driveResult.webViewLink,
    });

    await CommentJob.findByIdAndUpdate(commentJob._id, {
      outputVideoId: outputVideo._id,
      status: "done",
    });

    // ── 10. Emit activity event ─────────────────────────────────────────────
    try {
      await ActivityEvent.create({
        type:     "video_ready",
        title:    captionTitle,
        platform,
        jobId:    commentJob._id,
      });
    } catch { /* non-fatal */ }

    // Clean up tmp file
    try { fs.unlinkSync(outputPath); } catch { /* non-fatal */ }

    return {
      commentJobId:    String(commentJob._id),
      videoId:         String(outputVideo._id),
      driveWebViewLink: driveResult.webViewLink,
      attributes,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await CommentJob.findByIdAndUpdate(commentJob._id, {
      status: "failed",
      errorMsg: errMsg,
    });
    throw err;
  }
}

// ── Batch runner: process only the last updated published video ───────────────

/**
 * Finds the most recently updated published YouTube video and runs the comment
 * pipeline for it (if its comments haven't been processed yet).
 *
 * Called by the BullMQ `comments:generate` job handler every hour.
 */
export async function runCommentPipelineForAllVideos(): Promise<{
  processed: number;
  skipped: number;
  errors: { videoId: string; error: string }[];
}> {
  await connectDB();

  // Find the single most recently updated published YouTube video
  const latestVideo = await Video.findOne({
    platform:      "youtube",
    publishStatus: "published",
    externalId:    { $ne: "" },
  })
    .sort({ updatedAt: -1 })
    .select("_id title externalId")
    .lean();

  if (!latestVideo) {
    console.log(`[comment-pipeline] No published YouTube videos found`);
    return { processed: 0, skipped: 0, errors: [] };
  }

  console.log(`[comment-pipeline] Processing latest video: ${latestVideo.externalId} — "${latestVideo.title}"`);

  const youtubeId = latestVideo.externalId;

  try {
    await runCommentPipeline(youtubeId, String(latestVideo._id), "youtube");
    return { processed: 1, skipped: 0, errors: [] };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.includes("Already processed")) {
      console.log(`[comment-pipeline] Skipped ${youtubeId}: ${errMsg}`);
      return { processed: 0, skipped: 1, errors: [] };
    }

    console.error(`[comment-pipeline] Error for ${youtubeId}:`, err);
    return { processed: 0, skipped: 0, errors: [{ videoId: youtubeId, error: errMsg }] };
  }
}
