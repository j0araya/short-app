/**
 * video-gen.ts
 *
 * Generates a 9:16 MP4 (or PNG set) from a Hacker News story.
 *
 * Four paths depending on contentType + videoStyle + source:
 *
 * A) short_video + YouTube source (hasVideo = true):
 *    - Fetches transcript → subtitle slides
 *
 * B-narrative) short_video, style "narrative":
 *    - 4 slides: Hook → Context → Detail → CTA
 *
 * B-list) short_video, style "list":
 *    - Hook slide + 4 numbered fact slides + CTA slide (6 total)
 *
 * C) instagram_reel:
 *    - IG-branded 9:16 slides
 *
 * D) instagram_post:
 *    - 1080×1080 carousel PNGs — no MP4. Returns carouselPaths instead of videoPath.
 *
 * All video paths produce FFmpeg xfade slideshow → /tmp/short-app/<jobId>.mp4
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  buildNarrativeSlide,
  buildListSlide,
  buildCarouselSlide,
  buildTitleSlide,
  buildSubtitleSlide,
  buildInstagramSlide,
  SLIDE_W,
  SLIDE_H,
} from "./slide-gen";
import { generateSlideContent } from "./slide-content";
import type { VideoStyle } from "./slide-content";
import { fetchSubtitleSlides } from "./subtitles";
import { projectConfig } from "@/project.config";
import type { ContentType } from "@/lib/db/models/Job";

const SLIDE_DURATION = 3;
const FADE_DURATION = 0.5;

export interface VideoGenResult {
  videoPath: string | null;       // null for instagram_post (no MP4)
  carouselPaths: string[] | null; // PNG paths for instagram_post carousel
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
 *
 * FFmpeg 8 no longer accepts -s together with -filter_complex: the implicit
 * scale filter it inserts conflicts with the named output label [v].
 * Instead we append an explicit scale step at the end of the chain so the
 * final output [v] is already the correct resolution. The -s flag is not used.
 */
function buildXfadeFilter(n: number, w: number, h: number): { filter: string; totalDuration: number } {
  const scale = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;

  if (n === 1) {
    return { filter: `[0:v]${scale}[v]`, totalDuration: SLIDE_DURATION };
  }

  const parts: string[] = [];
  let offset = SLIDE_DURATION - FADE_DURATION;

  parts.push(
    `[0:v][1:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset}[x01]`
  );

  for (let i = 2; i < n; i++) {
    offset += SLIDE_DURATION - FADE_DURATION;
    const inLabel  = `x0${i - 1}`;
    const outLabel = `x0${i}`;
    parts.push(
      `[${inLabel}][${i}:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset}[${outLabel}]`
    );
  }

  // Final xfade output → scale → [v]
  const lastXLabel = n === 2 ? "x01" : `x0${n - 1}`;
  parts.push(`[${lastXLabel}]${scale}[v]`);

  return {
    filter: parts.join(";"),
    totalDuration: n * SLIDE_DURATION - (n - 1) * FADE_DURATION,
  };
}

async function buildSlideshowVideo(
  slidePaths: string[],
  outputPath: string,
  maxDuration: number
): Promise<number> {
  const { filter, totalDuration } = buildXfadeFilter(slidePaths.length, SLIDE_W, SLIDE_H);
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
    // Target 2 Mbps with a guaranteed floor of 500 Kbps.
    // TikTok requires ≥ 350 Kbps; YouTube Shorts recommends ≥ 1 Mbps.
    // CRF alone on static slides can drop below 100 Kbps — hence explicit bitrate.
    "-b:v", "2000k",
    "-minrate", "500k",
    "-maxrate", "4000k",
    "-bufsize", "4000k",
    "-t", String(finalDuration),
    "-r", "30",
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
  hashtags?: string,
  videoStyle: VideoStyle = "narrative"
): Promise<VideoGenResult> {
  const tmpDir = getTmpDir();
  const outputPath = path.join(tmpDir, `${jobId}.mp4`);
  const slidePaths: string[] = [];
  const maxDuration = projectConfig.video.durationSeconds;

  // ── Path D: Instagram Post — carousel PNGs (no MP4) ───────────────────────
  if (contentType === "instagram_post") {
    console.log(`[video-gen] Instagram Post (carousel) mode`);

    let ogImagePath: string | null = null;
    if (articleUrl) {
      const ogDest = path.join(tmpDir, `${jobId}_og.jpg`);
      ogImagePath = await fetchOGImage(articleUrl, ogDest);
      console.log(ogImagePath ? `[video-gen] OG image fetched` : `[video-gen] no OG image`);
    }

    console.log(`[video-gen] generating carousel content via AI`);
    const content = await generateSlideContent(title, "", "list");
    if (content.style !== "list") throw new Error("Expected list content for carousel");

    const totalSlides = content.items.length + 2; // cover + items + outro
    const carouselPaths: string[] = [];

    // Cover slide
    const coverPath = path.join(tmpDir, `${jobId}_carousel_0.png`);
    await buildCarouselSlide({
      slideType: "cover",
      text: content.hook,
      slideNum: 1,
      totalSlides,
      bgImagePath: ogImagePath,
      outPath: coverPath,
    });
    carouselPaths.push(coverPath);
    console.log(`[video-gen] carousel cover built`);

    // Item slides
    for (let i = 0; i < content.items.length; i++) {
      // Strip leading "1. " numbering from AI output — we render our own badge
      const rawText = content.items[i].replace(/^\d+\.\s*/, "");
      const itemPath = path.join(tmpDir, `${jobId}_carousel_${i + 1}.png`);
      await buildCarouselSlide({
        slideType: "item",
        text: rawText,
        itemNumber: i + 1,
        slideNum: i + 2,
        totalSlides,
        bgImagePath: null,
        outPath: itemPath,
      });
      carouselPaths.push(itemPath);
      console.log(`[video-gen] carousel item ${i + 1}/${content.items.length} built`);
    }

    // Outro slide
    const outroPath = path.join(tmpDir, `${jobId}_carousel_outro.png`);
    await buildCarouselSlide({
      slideType: "outro",
      text: content.cta,
      slideNum: totalSlides,
      totalSlides,
      bgImagePath: null,
      outPath: outroPath,
    });
    carouselPaths.push(outroPath);
    console.log(`[video-gen] carousel outro built — ${carouselPaths.length} tiles total`);

    if (ogImagePath) {
      try { fs.unlinkSync(ogImagePath); } catch { /* non-fatal */ }
    }

    return { videoPath: null, carouselPaths, durationSeconds: 0 };
  }

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
      await buildTitleSlide({ title, outPath: titlePath });
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

  // ── Path B: Narrative or List slideshow (short_video, or YT transcript fallback) ─
  if (contentType === "short_video" && (!hasVideo || slidePaths.length === 0)) {
    // Fetch OG image once — reused as background
    let ogImagePath: string | null = null;
    if (articleUrl) {
      const ogDest = path.join(tmpDir, `${jobId}_og.jpg`);
      ogImagePath = await fetchOGImage(articleUrl, ogDest);
      console.log(ogImagePath
        ? `[video-gen] OG image fetched`
        : `[video-gen] no OG image — using gradient bg`
      );
    }

    console.log(`[video-gen] generating slide content via AI (style: ${videoStyle})`);
    const slideContent = await generateSlideContent(title, "", videoStyle);
    console.log(`[video-gen] slide content ready:`, JSON.stringify(slideContent));

    if (slideContent.style === "list") {
      // ── List style: hook + items + cta ──
      const totalSlides = slideContent.items.length + 2; // hook + items + cta

      const hookPath = path.join(tmpDir, `${jobId}_slide0.png`);
      await buildListSlide({
        slideType: "hook",
        text: slideContent.hook,
        slideNum: 1,
        totalSlides,
        bgImagePath: ogImagePath,
        outPath: hookPath,
      });
      slidePaths.push(hookPath);
      console.log(`[video-gen] slide 1/${totalSlides} — hook`);

      for (let i = 0; i < slideContent.items.length; i++) {
        const rawText = slideContent.items[i].replace(/^\d+\.\s*/, "");
        const itemPath = path.join(tmpDir, `${jobId}_slide${i + 1}.png`);
        await buildListSlide({
          slideType: "item",
          text: rawText,
          itemNumber: i + 1,
          slideNum: i + 2,
          totalSlides,
          bgImagePath: null,
          outPath: itemPath,
        });
        slidePaths.push(itemPath);
        console.log(`[video-gen] slide ${i + 2}/${totalSlides} — item ${i + 1}`);
      }

      const ctaPath = path.join(tmpDir, `${jobId}_slide${slideContent.items.length + 1}.png`);
      await buildListSlide({
        slideType: "cta",
        text: slideContent.cta,
        slideNum: totalSlides,
        totalSlides,
        bgImagePath: null,
        outPath: ctaPath,
      });
      slidePaths.push(ctaPath);
      console.log(`[video-gen] slide ${totalSlides}/${totalSlides} — cta`);

    } else {
      // ── Narrative style: hook / context / detail / cta ──
      const SLIDE_TYPES = ["hook", "context", "detail", "cta"] as const;
      const SLIDE_TEXTS = [
        slideContent.hook,
        slideContent.context,
        slideContent.detail,
        slideContent.cta,
      ];

      for (let i = 0; i < 4; i++) {
        const slidePath = path.join(tmpDir, `${jobId}_slide${i}.png`);
        await buildNarrativeSlide({
          slideType: SLIDE_TYPES[i],
          text: SLIDE_TEXTS[i],
          slideNum: i + 1,
          totalSlides: 4,
          bgImagePath: ogImagePath,
          outPath: slidePath,
        });
        slidePaths.push(slidePath);
        console.log(`[video-gen] slide ${i + 1}/4 — ${SLIDE_TYPES[i]}`);
      }
    }

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

  return { videoPath: outputPath, carouselPaths: null, durationSeconds: finalDuration };
}
