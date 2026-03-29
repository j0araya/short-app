/**
 * slide-gen.ts
 *
 * Generates 1080x1920 (9:16) PNG slides for a Shorts-style image slideshow.
 *
 * Slide layout:
 *   - Slide 1 (title card): HN logo + article title + score badge
 *   - Slide 2+ (content): OG image as background (if available) + dark overlay + excerpt text
 *   - Fallback background: dark gradient when no image is available
 *
 * Uses sharp for compositing and SVG for text rendering.
 * No external fonts needed — system sans-serif via SVG.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

export const SLIDE_W = 1080;
export const SLIDE_H = 1920;

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0d1117",          // dark base
  surface: "#161b22",     // card surface
  accent: "#ff6600",      // HN orange
  igAccent: "#E1306C",    // Instagram pink/red
  igGradStart: "#833AB4", // IG gradient purple
  igGradEnd: "#FD1D1D",   // IG gradient red
  text: "#f0f6fc",        // primary text
  muted: "#8b949e",       // secondary text
  white: "#ffffff",
};

// ── SVG helpers ───────────────────────────────────────────────────────────────

/** Escape XML special chars for safe SVG embedding */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Naive word-wrap: split text into lines of max `maxChars` characters.
 */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// ── Slide builders ────────────────────────────────────────────────────────────

/**
 * Slide 1 — Title card
 * Dark background, HN logo pill, large title text, score badge.
 */
export async function buildTitleSlide(opts: {
  title: string;
  score: number;
  outPath: string;
}): Promise<void> {
  const { title, score, outPath } = opts;

  const lines = wrapText(title, 28);
  const lineHeight = 100;
  const blockH = lines.length * lineHeight;
  const startY = (SLIDE_H - blockH) / 2;

  // HN logo pill — top center
  const logoY = startY - 200;
  const logoSvg = `
    <rect x="${SLIDE_W / 2 - 80}" y="${logoY}" width="160" height="60" rx="12"
          fill="${C.accent}"/>
    <text x="${SLIDE_W / 2}" y="${logoY + 42}" font-family="sans-serif"
          font-size="28" font-weight="700" fill="${C.white}"
          text-anchor="middle">Hacker News</text>
  `;

  // Title lines
  const titleSvg = lines
    .map((line, i) => {
      const y = startY + i * lineHeight + 72;
      return `<text x="${SLIDE_W / 2}" y="${y}"
        font-family="sans-serif" font-size="72" font-weight="700"
        fill="${C.text}" text-anchor="middle">${esc(line)}</text>`;
    })
    .join("\n");

  // Score badge — below title
  const badgeY = startY + blockH + 80;
  const badgeSvg = `
    <rect x="${SLIDE_W / 2 - 100}" y="${badgeY}" width="200" height="56" rx="28"
          fill="${C.surface}" stroke="${C.accent}" stroke-width="2"/>
    <text x="${SLIDE_W / 2}" y="${badgeY + 38}" font-family="sans-serif"
          font-size="28" font-weight="600" fill="${C.accent}"
          text-anchor="middle">▲ ${score} points</text>
  `;

  // Bottom label
  const labelSvg = `
    <text x="${SLIDE_W / 2}" y="${SLIDE_H - 80}" font-family="sans-serif"
          font-size="32" fill="${C.muted}" text-anchor="middle">
      news.ycombinator.com
    </text>
  `;

  const svg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background gradient -->
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.bg}"/>
          <stop offset="100%" stop-color="#0a0f1a"/>
        </linearGradient>
      </defs>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bg)"/>

      <!-- Left accent bar -->
      <rect x="60" y="${startY - 30}" width="6" height="${blockH + 60}"
            rx="3" fill="${C.accent}" opacity="0.6"/>

      ${logoSvg}
      ${titleSvg}
      ${badgeSvg}
      ${labelSvg}
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outPath);
}

/**
 * Slide 2+ — Content slide
 * Optional background image (OG image scaled/cropped to 9:16) + dark overlay + text.
 */
export async function buildContentSlide(opts: {
  text: string;
  bgImagePath: string | null;
  slideNum: number;
  totalSlides: number;
  outPath: string;
}): Promise<void> {
  const { text, bgImagePath, slideNum, totalSlides, outPath } = opts;

  const lines = wrapText(text, 32);
  const lineHeight = 80;
  const blockH = lines.length * lineHeight;
  const startY = (SLIDE_H - blockH) / 2;

  const textSvg = lines
    .map((line, i) => {
      const y = startY + i * lineHeight + 56;
      return `<text x="${SLIDE_W / 2}" y="${y}"
        font-family="sans-serif" font-size="56" font-weight="600"
        fill="${C.white}" text-anchor="middle"
        filter="url(#shadow)">${esc(line)}</text>`;
    })
    .join("\n");

  // Progress dots
  const dotSpacing = 28;
  const totalDotW = totalSlides * dotSpacing;
  const dotStartX = (SLIDE_W - totalDotW) / 2;
  const dotsSvg = Array.from({ length: totalSlides }, (_, i) => {
    const cx = dotStartX + i * dotSpacing + 10;
    const active = i === slideNum - 1;
    return `<circle cx="${cx}" cy="${SLIDE_H - 60}" r="${active ? 8 : 5}"
      fill="${active ? C.accent : C.muted}" opacity="${active ? 1 : 0.5}"/>`;
  }).join("\n");

  const overlaySvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.8"/>
        </filter>
        <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.3"/>
          <stop offset="40%" stop-color="#000" stop-opacity="0.7"/>
          <stop offset="60%" stop-color="#000" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#overlay)"/>
      ${textSvg}
      ${dotsSvg}
    </svg>
  `;

  if (bgImagePath && fs.existsSync(bgImagePath)) {
    // Composite: scale+crop bg image to 9:16, then overlay SVG
    await sharp(bgImagePath)
      .resize(SLIDE_W, SLIDE_H, { fit: "cover", position: "centre" })
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png()
      .toFile(outPath);
  } else {
    // No image — dark gradient background
    const bgSvg = `
      <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0d1117"/>
            <stop offset="100%" stop-color="#0a0f1a"/>
          </linearGradient>
        </defs>
        <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bg)"/>
      </svg>
    `;
    await sharp(Buffer.from(bgSvg))
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png()
      .toFile(outPath);
  }
}

/**
 * Subtitle slide — used when source is a YouTube video with transcript.
 * Dark background + large centered text + slide number indicator.
 */
export async function buildSubtitleSlide(opts: {
  text: string;
  slideNum: number;
  totalSlides: number;
  outPath: string;
}): Promise<void> {
  const { text, slideNum, totalSlides, outPath } = opts;

  const lines = wrapText(text, 26);
  const lineHeight = 96;
  const blockH = lines.length * lineHeight;
  const startY = (SLIDE_H - blockH) / 2;

  const textSvg = lines
    .map((line, i) => {
      const y = startY + i * lineHeight + 68;
      return `<text x="${SLIDE_W / 2}" y="${y}"
        font-family="sans-serif" font-size="80" font-weight="700"
        fill="${C.white}" text-anchor="middle"
        filter="url(#shadow)">${esc(line)}</text>`;
    })
    .join("\n");

  // Progress bar at bottom
  const barW = SLIDE_W - 120;
  const fillW = Math.round((slideNum / totalSlides) * barW);
  const progressSvg = `
    <rect x="60" y="${SLIDE_H - 48}" width="${barW}" height="8" rx="4" fill="${C.surface}"/>
    <rect x="60" y="${SLIDE_H - 48}" width="${fillW}" height="8" rx="4" fill="${C.accent}"/>
    <text x="${SLIDE_W / 2}" y="${SLIDE_H - 64}" font-family="sans-serif"
          font-size="28" fill="${C.muted}" text-anchor="middle">
      ${slideNum} / ${totalSlides}
    </text>
  `;

  const svg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.bg}"/>
          <stop offset="100%" stop-color="#0a0f1a"/>
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bg)"/>

      <!-- Accent left bar -->
      <rect x="60" y="${startY - 20}" width="6" height="${blockH + 40}"
            rx="3" fill="${C.accent}" opacity="0.7"/>

      ${textSvg}
      ${progressSvg}
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

/**
 * Instagram Reel / Post slide
 *
 * Aesthetic: bold gradient header bar, large title text, optional OG image
 * as full-bleed background, dark overlay, slide counter, IG-brand accent colors.
 *
 * Used for instagram_reel and instagram_post content types.
 */
export async function buildInstagramSlide(opts: {
  text: string;
  bgImagePath: string | null;
  slideNum: number;
  totalSlides: number;
  outPath: string;
  /** Show the caption/hashtag hint on the last slide */
  isLast?: boolean;
  hashtags?: string;
}): Promise<void> {
  const { text, bgImagePath, slideNum, totalSlides, outPath, isLast, hashtags } = opts;

  const lines = wrapText(text, 28);
  const lineHeight = 90;
  const blockH = lines.length * lineHeight;
  const startY = (SLIDE_H - blockH) / 2;

  // IG gradient top bar
  const barH = 120;
  const topBarSvg = `
    <defs>
      <linearGradient id="igGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${C.igGradStart}"/>
        <stop offset="50%" stop-color="${C.igAccent}"/>
        <stop offset="100%" stop-color="${C.igGradEnd}"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${SLIDE_W}" height="${barH}" fill="url(#igGrad)"/>
    <text x="${SLIDE_W / 2}" y="${barH / 2 + 14}" font-family="sans-serif"
          font-size="36" font-weight="700" fill="${C.white}"
          text-anchor="middle" letter-spacing="4">TECH NEWS</text>
  `;

  // Slide counter (top-right inside bar)
  const counterSvg = `
    <text x="${SLIDE_W - 40}" y="${barH - 20}" font-family="sans-serif"
          font-size="28" fill="${C.white}" text-anchor="end" opacity="0.8">
      ${slideNum}/${totalSlides}
    </text>
  `;

  const textSvg = lines
    .map((line, i) => {
      const y = startY + i * lineHeight + 68;
      return `<text x="${SLIDE_W / 2}" y="${y}"
        font-family="sans-serif" font-size="72" font-weight="800"
        fill="${C.white}" text-anchor="middle"
        filter="url(#textShadow)">${esc(line)}</text>`;
    })
    .join("\n");

  // CTA on last slide
  const ctaSvg = isLast && hashtags
    ? `<text x="${SLIDE_W / 2}" y="${SLIDE_H - 120}" font-family="sans-serif"
         font-size="32" fill="${C.igAccent}" text-anchor="middle"
         font-weight="600">${esc(hashtags.split(" ").slice(0, 4).join(" "))}</text>
       <text x="${SLIDE_W / 2}" y="${SLIDE_H - 70}" font-family="sans-serif"
         font-size="28" fill="${C.muted}" text-anchor="middle">Follow for more</text>`
    : "";

  const overlaySvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="igGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${C.igGradStart}"/>
          <stop offset="50%" stop-color="${C.igAccent}"/>
          <stop offset="100%" stop-color="${C.igGradEnd}"/>
        </linearGradient>
        <filter id="textShadow">
          <feDropShadow dx="0" dy="3" stdDeviation="8" flood-color="#000" flood-opacity="0.9"/>
        </filter>
        <linearGradient id="darkOverlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.15"/>
          <stop offset="30%" stop-color="#000" stop-opacity="0.65"/>
          <stop offset="70%" stop-color="#000" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#darkOverlay)"/>
      ${topBarSvg}
      ${counterSvg}
      ${textSvg}
      ${ctaSvg}
    </svg>
  `;

  if (bgImagePath && fs.existsSync(bgImagePath)) {
    await sharp(bgImagePath)
      .resize(SLIDE_W, SLIDE_H, { fit: "cover", position: "centre" })
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png()
      .toFile(outPath);
  } else {
    // Dark gradient background with IG accent
    const bgSvg = `
      <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a0a2e"/>
            <stop offset="100%" stop-color="#0d1117"/>
          </linearGradient>
        </defs>
        <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)"/>
      </svg>
    `;
    await sharp(Buffer.from(bgSvg))
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png()
      .toFile(outPath);
  }
}
