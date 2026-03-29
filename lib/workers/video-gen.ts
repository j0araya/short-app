/**
 * video-gen.ts
 *
 * Generates a 9:16 MP4 from a Hacker News story.
 *
 * Three modes depending on contentType + source:
 *
 * A) short_video + YouTube source (hasVideo = true):
 *    - Fetches transcript via youtube-transcript (no API key)
 *    - Builds subtitle slides: title card + one slide per ~20-word chunk
 *
 * B) short_video + regular article:
 *    - Slide 1: title card (HN logo + title + score)
 *    - Slide 2: OG image + dark overlay + title text
 *
 * C) instagram_reel:
 *    - IG-branded slides with gradient header, bold text, OG image bg
 *    - Last slide includes hashtag preview + "Follow for more" CTA
 *
 * All paths produce FFmpeg xfade slideshow → /tmp/short-app/<jobId>.mp4
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  buildTitleSlide,
  buildContentSlide,
  buildSubtitleSlide,
  buildInstagramSlide,
  SLIDE_W,
  SLIDE_H,
} from "./slide-gen";
import { fetchSubtitleSlides } from "./subtitles";
import { projectConfig } from "@/project.config";
import type { ContentType } from "@/lib/db/models/Job";

const SLIDE_DURATION = 3;
const FADE_DURATION = 0.5;

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

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}:\n${stderr.slice(-1500)}`));
    });
    proc.on("error", reject);
  });
}

async function fetchOGImage(articleUrl: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; short-app/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (!match?.[1]) return null;

    let ogUrl = match[1];
    if (ogUrl.startsWith("/")) {
      const base = new URL(articleUrl);
      ogUrl = `${base.protocol}//${base.host}${ogUrl}`;
    }

    const imgRes = await fetch(ogUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) return null;

    fs.writeFileSync(destPath, Buffer.from(await imgRes.arrayBuffer()));
    return destPath;
  } catch {
    return null;
  }
}

/**
 * Build FFmpeg xfade filter_complex for N slides.
 * Each slide input is pre-trimmed to SLIDE_DURATION + FADE_DURATION.
 */
function buildXfadeFilter(n: number): { filter: string; totalDuration: number } {
  if (n === 1) {
    return { filter: "[0:v]null[v]", totalDuration: SLIDE_DURATION };
  }

  const parts: string[] = [];
  let offset = SLIDE_DURATION - FADE_DURATION;

  parts.push(
    `[0:v][1:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset}[v01]`
  );

  for (let i = 2; i < n; i++) {
    offset += SLIDE_DURATION - FADE_DURATION;
    const inLabel = `v0${i - 1}`;
    const outLabel = i === n - 1 ? "v" : `v0${i}`;
    parts.push(
      `[${inLabel}][${i}:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset}[${outLabel}]`
    );
  }

  const filter = n === 2
    ? parts[0].replace("[v01]", "[v]")
    : parts.join(";");

  return {
    filter,
    totalDuration: n * SLIDE_DURATION - (n - 1) * FADE_DURATION,
  };
}

async function buildSlideshowVideo(
  slidePaths: string[],
  outputPath: string,
  maxDuration: number
): Promise<number> {
  const { filter, totalDuration } = buildXfadeFilter(slidePaths.length);
  const finalDuration = Math.min(totalDuration, maxDuration);

  const inputArgs: string[] = [];
  for (const p of slidePaths) {
    inputArgs.push("-loop", "1", "-t", String(SLIDE_DURATION + FADE_DURATION), "-i", p);
  }

  await runFFmpeg([
    ...inputArgs,
    "-filter_complex", filter,
    "-map", "[v]",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-t", String(finalDuration),
    "-r", "30",
    "-s", `${SLIDE_W}x${SLIDE_H}`,
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    outputPath,
  ]);

  return finalDuration;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateVideo(
  jobId: string,
  title: string,
  articleUrl: string | null,
  score?: number,
  hasVideo?: boolean,
  contentType: ContentType = "short_video",
  hashtags?: string
): Promise<VideoGenResult> {
  const tmpDir = getTmpDir();
  const outputPath = path.join(tmpDir, `${jobId}.mp4`);
  const slidePaths: string[] = [];
  const maxDuration = projectConfig.video.durationSeconds;

  // ── Path C: Instagram Reel ─────────────────────────────────────────────────
  if (contentType === "instagram_reel") {
    console.log(`[video-gen] Instagram Reel mode`);

    // Fetch OG image
    let ogImagePath: string | null = null;
    if (articleUrl) {
      const ogDest = path.join(tmpDir, `${jobId}_og.jpg`);
      ogImagePath = await fetchOGImage(articleUrl, ogDest);
    }

    // Slide 0: title/intro
    const titlePath = path.join(tmpDir, `${jobId}_ig0.png`);
    await buildInstagramSlide({
      text: title,
      bgImagePath: ogImagePath,
      slideNum: 1,
      totalSlides: 3,
      outPath: titlePath,
    });
    slidePaths.push(titlePath);

    // Slide 1: headline rephrased (shorter excerpt from title)
    const shortText = title.length > 60 ? title.slice(0, 60).trim() + "…" : title;
    const slide1Path = path.join(tmpDir, `${jobId}_ig1.png`);
    await buildInstagramSlide({
      text: shortText,
      bgImagePath: ogImagePath,
      slideNum: 2,
      totalSlides: 3,
      outPath: slide1Path,
    });
    slidePaths.push(slide1Path);

    // Slide 2: CTA with hashtags
    const slide2Path = path.join(tmpDir, `${jobId}_ig2.png`);
    await buildInstagramSlide({
      text: "Follow for more tech news",
      bgImagePath: ogImagePath,
      slideNum: 3,
      totalSlides: 3,
      outPath: slide2Path,
      isLast: true,
      hashtags,
    });
    slidePaths.push(slide2Path);

    if (ogImagePath) slidePaths.push(ogImagePath);

    console.log(`[video-gen] ${slidePaths.filter((p) => p.endsWith(".png")).length} IG slides built`);
  }

  // ── Path A: YouTube video → subtitle slides ───────────────────────────────
  if (contentType === "short_video" && hasVideo && articleUrl) {
    console.log(`[video-gen] YouTube source — fetching transcript`);
    const subtitleSlides = await fetchSubtitleSlides(articleUrl);

    if (subtitleSlides && subtitleSlides.length > 0) {
      console.log(`[video-gen] transcript: ${subtitleSlides.length} slides`);
      const totalSlides = subtitleSlides.length + 1;

      const titlePath = path.join(tmpDir, `${jobId}_slide0.png`);
      await buildTitleSlide({ title, score: score ?? 0, outPath: titlePath });
      slidePaths.push(titlePath);

      for (let i = 0; i < subtitleSlides.length; i++) {
        const p = path.join(tmpDir, `${jobId}_slide${i + 1}.png`);
        await buildSubtitleSlide({
          text: subtitleSlides[i].text,
          slideNum: i + 1,
          totalSlides,
          outPath: p,
        });
        slidePaths.push(p);
      }

      console.log(`[video-gen] ${slidePaths.length} subtitle slides built`);
    } else {
      console.log(`[video-gen] transcript unavailable — falling back to slideshow`);
      hasVideo = false;
    }
  }

  // ── Path B: Article slideshow (short_video, or YT transcript fallback) ────
  if (contentType === "short_video" && (!hasVideo || slidePaths.length === 0)) {
    const titlePath = path.join(tmpDir, `${jobId}_slide0.png`);
    await buildTitleSlide({ title, score: score ?? 0, outPath: titlePath });
    slidePaths.push(titlePath);
    console.log(`[video-gen] slide 1 — title card`);

    let ogImagePath: string | null = null;
    if (articleUrl) {
      const ogDest = path.join(tmpDir, `${jobId}_og.jpg`);
      ogImagePath = await fetchOGImage(articleUrl, ogDest);
      console.log(ogImagePath
        ? `[video-gen] OG image fetched`
        : `[video-gen] no OG image — using solid bg`
      );
    }

    const contentPath = path.join(tmpDir, `${jobId}_slide1.png`);
    await buildContentSlide({
      text: title,
      bgImagePath: ogImagePath,
      slideNum: 2,
      totalSlides: 2,
      outPath: contentPath,
    });
    slidePaths.push(contentPath);
    console.log(`[video-gen] slide 2 — content slide`);

    if (ogImagePath) slidePaths.push(ogImagePath);
  }

  // ── FFmpeg ────────────────────────────────────────────────────────────────
  const pngSlides = slidePaths.filter((p) => p.endsWith(".png"));
  console.log(`[video-gen] running FFmpeg — ${pngSlides.length} slides`);
  const finalDuration = await buildSlideshowVideo(pngSlides, outputPath, maxDuration);
  console.log(`[video-gen] done → ${outputPath} (${finalDuration}s)`);

  // Cleanup intermediates
  for (const p of slidePaths) {
    try { fs.unlinkSync(p); } catch { /* non-fatal */ }
  }

  return { videoPath: outputPath, durationSeconds: finalDuration };
}
