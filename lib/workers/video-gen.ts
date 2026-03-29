/**
 * Video generation worker
 *
 * Pipeline:
 *   1. Download thumbnail image (or generate solid color bg if none)
 *   2. Generate TTS audio via ElevenLabs
 *   3. FFmpeg compose:
 *        - Scale + pad thumbnail to 1080x1920 (9:16)
 *        - Animated word-by-word subtitle overlay (drawtext filter)
 *        - Mux with TTS audio
 *        - Output: /tmp/short-app/<jobId>.mp4
 *
 * All settings come from projectConfig — nothing hardcoded.
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { generateTTS } from "./tts";
import { projectConfig } from "@/project.config";

// 9:16 vertical — standard for Shorts/TikTok/Reels
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;

export interface VideoGenResult {
  videoPath: string;
  durationSeconds: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTmpDir(): string {
  const dir = path.join("/tmp", "short-app");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function downloadThumbnail(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download thumbnail: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}:\n${stderr.slice(-1000)}`));
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Build FFmpeg drawtext filter expressions for word-by-word animation.
 *
 * Strategy: evenly distribute words across the audio duration.
 * Each word appears at its estimated timestamp and stays visible.
 *
 * Font: uses ffmpeg's built-in "Sans" — no external font file needed.
 */
function buildSubtitleFilter(title: string, audioDuration: number): string {
  const words = title.trim().split(/\s+/);
  const timePerWord = audioDuration / words.length;

  // Group words into lines of max 4 words to fit the vertical frame
  const lines: string[][] = [];
  for (let i = 0; i < words.length; i += 4) {
    lines.push(words.slice(i, i + 4));
  }

  const filters: string[] = [];
  let wordIndex = 0;

  lines.forEach((lineWords, lineIdx) => {
    const lineText = lineWords.map((w) => w.replace(/'/g, "\u2019")).join(" ");
    const startTime = wordIndex * timePerWord;
    const endTime = Math.min((wordIndex + lineWords.length) * timePerWord + 0.3, audioDuration);

    // y position: center with slight offset per line
    const yOffset = lineIdx * 80;
    const y = `(h/2)-40+${yOffset}`;

    // Escape special characters for ffmpeg drawtext
    const escaped = lineText
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\u2019");

    filters.push(
      `drawtext=` +
        `text='${escaped}':` +
        `fontsize=72:` +
        `fontcolor=white:` +
        `borderw=4:` +
        `bordercolor=black:` +
        `x=(w-text_w)/2:` +
        `y=${y}:` +
        `enable='between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})'`
    );

    wordIndex += lineWords.length;
  });

  return filters.join(",");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateVideo(
  jobId: string,
  title: string,
  thumbnail: string | null
): Promise<VideoGenResult> {
  const { durationSeconds } = projectConfig.video;
  const tmpDir = getTmpDir();
  const outputPath = path.join(tmpDir, `${jobId}.mp4`);

  // ── 1. TTS ────────────────────────────────────────────────────────────────
  const { audioPath, durationSeconds: estimatedDuration } = await generateTTS(jobId, title);
  const audioDuration = Math.min(estimatedDuration, durationSeconds);

  // ── 2. Thumbnail ──────────────────────────────────────────────────────────
  let imageInput: string;

  if (thumbnail) {
    const thumbPath = path.join(tmpDir, `${jobId}_thumb.jpg`);
    try {
      await downloadThumbnail(thumbnail, thumbPath);
      imageInput = thumbPath;
    } catch (err) {
      console.warn(`[video-gen] thumbnail download failed, using solid bg:`, err);
      imageInput = ""; // fallback to generated bg
    }
  } else {
    imageInput = "";
  }

  // ── 3. FFmpeg ─────────────────────────────────────────────────────────────
  const subtitleFilter = buildSubtitleFilter(title, audioDuration);

  let ffmpegArgs: string[];

  if (imageInput && fs.existsSync(imageInput)) {
    // Input: real thumbnail
    // Scale to cover 9:16, then pad any gaps, then add subtitles
    const videoFilter = [
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase`,
      `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
      subtitleFilter,
    ].join(",");

    ffmpegArgs = [
      "-loop", "1",
      "-i", imageInput,
      "-i", audioPath,
      "-vf", videoFilter,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-t", String(audioDuration),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ];
  } else {
    // No thumbnail — solid dark background via lavfi, subtitle via -vf
    ffmpegArgs = [
      "-f", "lavfi",
      "-i", `color=c=#0f0f0f:size=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:rate=30`,
      "-i", audioPath,
      "-vf", subtitleFilter,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-t", String(audioDuration),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ];
  }

  console.log(`[video-gen] running FFmpeg for job ${jobId}`);
  await runFFmpeg(ffmpegArgs);
  console.log(`[video-gen] done → ${outputPath}`);

  // Cleanup intermediate files
  try {
    fs.unlinkSync(audioPath);
    if (imageInput && fs.existsSync(imageInput)) fs.unlinkSync(imageInput);
  } catch {
    // non-fatal
  }

  return { videoPath: outputPath, durationSeconds: audioDuration };
}
