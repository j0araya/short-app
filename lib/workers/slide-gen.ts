/**
 * slide-gen.ts
 *
 * Generates PNG slides for YouTube Shorts / TikTok / Reels / Instagram.
 *
 * Slide sizes:
 *   1080×1920 — 9:16 vertical (Shorts, Reels, TikTok)
 *   1080×1080 — 1:1 square (Instagram feed carousel)
 *
 * Content styles:
 *   buildNarrativeSlide()  — 4-slide story arc (hook/context/detail/cta)
 *   buildListSlide()       — "Did you know?" numbered list style (9:16)
 *   buildCarouselSlide()   — Instagram carousel tile (1080×1080)
 *
 * Uses sharp for compositing and inline SVG for layout.
 * No external font files required — system sans-serif.
 */

import fs from "fs";
import sharp from "sharp";

export const SLIDE_W = 1080;
export const SLIDE_H = 1920;

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  // Backgrounds
  bgDeep:   "#080c18",   // darkest base
  bgMid:    "#0d1426",   // medium dark blue
  bgLight:  "#141e38",   // lighter panel color

  // Accents
  blue:     "#4f8ef7",   // electric blue
  cyan:     "#00d4ff",   // bright cyan
  orange:   "#ff7043",   // warm orange (for hook slides)
  green:    "#00e676",   // success green (for CTA slides)

  // Text
  white:    "#ffffff",
  offWhite: "#e8edf8",
  muted:    "#7a8aaa",
  dimmed:   "#4a5570",

  // IG
  igPurple: "#833AB4",
  igPink:   "#E1306C",
  igRed:    "#FD1D1D",
};

// ── Slide type accent colors ───────────────────────────────────────────────────
// Each slide type gets its own accent color so there's visual variety
const SLIDE_COLORS = {
  hook:    { accent: C.orange, label: "HOOK",    labelBg: "#ff7043" },
  context: { accent: C.blue,   label: "CONTEXT", labelBg: "#4f8ef7" },
  detail:  { accent: C.cyan,   label: "INSIGHT", labelBg: "#00d4ff" },
  cta:     { accent: C.green,  label: "YOUR TAKE", labelBg: "#00e676" },
} as const;

export type SlideType = keyof typeof SLIDE_COLORS;

// ── SVG helpers ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Word-wrap: builds lines with at most `maxChars` characters.
 * Tries not to break in the middle of a word.
 */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Shared background builder ─────────────────────────────────────────────────

/**
 * Build the base background PNG buffer.
 * - If bgImagePath is provided: OG image resized/cropped to 9:16 + color-grade overlay
 * - Otherwise: dark blue gradient
 */
async function buildBackground(
  bgImagePath: string | null,
  accentColor: string
): Promise<Buffer> {
  if (bgImagePath && fs.existsSync(bgImagePath)) {
    // Color-grade the OG image: darken + tint with accent
    const colorGrade = `
      <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
        <!-- Heavy darken -->
        <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="rgba(5,8,20,0.78)"/>
        <!-- Subtle color tint from the slide accent — bottom-to-top -->
        <defs>
          <linearGradient id="tint" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stop-color="${accentColor}" stop-opacity="0.18"/>
            <stop offset="60%"  stop-color="${accentColor}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#tint)"/>
      </svg>
    `;
    return await sharp(bgImagePath)
      .resize(SLIDE_W, SLIDE_H, { fit: "cover", position: "centre" })
      .composite([{ input: Buffer.from(colorGrade), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  // Gradient background — no image
  const gradSvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Main background gradient: deep navy top → midnight bottom -->
        <linearGradient id="main" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${C.bgMid}"/>
          <stop offset="100%" stop-color="${C.bgDeep}"/>
        </linearGradient>
        <!-- Diagonal accent sweep: very subtle colored glow from top-right -->
        <radialGradient id="glow" cx="80%" cy="20%" r="60%">
          <stop offset="0%"   stop-color="${accentColor}" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#main)"/>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#glow)"/>

      <!-- Subtle grid texture overlay (fine dots) -->
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="1" fill="${accentColor}" opacity="0.06"/>
        </pattern>
      </defs>
      <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#grid)"/>
    </svg>
  `;

  return await sharp(Buffer.from(gradSvg)).png().toBuffer();
}

// ── Brand header ──────────────────────────────────────────────────────────────

function brandHeader(accentColor: string): string {
  return `
    <!-- Brand bar: pill on top-left -->
    <rect x="60" y="72" width="200" height="56" rx="28"
          fill="${accentColor}" opacity="0.15"/>
    <rect x="60" y="72" width="200" height="56" rx="28"
          fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.5"/>
    <text x="160" y="108" font-family="sans-serif" font-size="26" font-weight="700"
          fill="${accentColor}" text-anchor="middle" letter-spacing="3">TECH NEWS</text>
  `;
}

// ── Slide label badge ─────────────────────────────────────────────────────────

function slideLabelBadge(label: string, accentColor: string): string {
  const badgeW = label.length * 18 + 48;
  return `
    <!-- Slide type label: top-right -->
    <rect x="${SLIDE_W - badgeW - 60}" y="72" width="${badgeW}" height="56" rx="28"
          fill="${accentColor}" opacity="0.2"/>
    <text x="${SLIDE_W - badgeW / 2 - 60}" y="108" font-family="sans-serif"
          font-size="22" font-weight="800" fill="${accentColor}"
          text-anchor="middle" letter-spacing="2">${esc(label)}</text>
  `;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function progressBar(slideNum: number, totalSlides: number, accentColor: string): string {
  const barX = 60;
  const barY = SLIDE_H - 80;
  const barW = SLIDE_W - 120;
  const barH = 6;
  const fillW = Math.round((slideNum / totalSlides) * barW);

  return `
    <!-- Progress bar -->
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="3"
          fill="rgba(255,255,255,0.08)"/>
    <rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" rx="3"
          fill="${accentColor}"/>
    <!-- Step dots -->
    ${Array.from({ length: totalSlides }, (_, i) => {
      const cx = barX + Math.round(((i + 1) / totalSlides) * barW);
      const active = i < slideNum;
      return `<circle cx="${cx}" cy="${barY + barH / 2}" r="${active ? 5 : 3}"
        fill="${active ? accentColor : "rgba(255,255,255,0.15)"}"/>`;
    }).join("")}
    <!-- Counter label -->
    <text x="${SLIDE_W / 2}" y="${SLIDE_H - 36}" font-family="sans-serif"
          font-size="24" fill="${accentColor}" text-anchor="middle" opacity="0.5"
          font-weight="600" letter-spacing="2">${slideNum} / ${totalSlides}</text>
  `;
}

// ── Left accent line ──────────────────────────────────────────────────────────

function accentLine(startY: number, endY: number, accentColor: string): string {
  return `
    <!-- Left accent line with glow -->
    <defs>
      <filter id="lineGlow">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect x="60" y="${startY}" width="5" height="${endY - startY}"
          rx="2.5" fill="${accentColor}" filter="url(#lineGlow)" opacity="0.9"/>
  `;
}

// ── Main text block ───────────────────────────────────────────────────────────

function textBlock(
  text: string,
  opts: {
    fontSize?: number;
    maxChars?: number;
    lineHeight?: number;
    centerX?: number;
    startY: number;
    color?: string;
    weight?: string;
    filterRef?: string;
  }
): { svg: string; blockH: number } {
  const {
    fontSize = 88,
    maxChars = 16,
    lineHeight = fontSize * 1.25,
    centerX = SLIDE_W / 2,
    startY,
    color = C.white,
    weight = "800",
    filterRef,
  } = opts;

  const lines = wrapText(text, maxChars);
  const blockH = lines.length * lineHeight;
  const filterAttr = filterRef ? `filter="${filterRef}"` : "";

  const svg = lines
    .map((line, i) => {
      const y = startY + i * lineHeight + fontSize * 0.85;
      return `<text x="${centerX}" y="${y}"
        font-family="sans-serif" font-size="${fontSize}" font-weight="${weight}"
        fill="${color}" text-anchor="middle" ${filterAttr}>${esc(line)}</text>`;
    })
    .join("\n");

  return { svg, blockH };
}

// ── Drop shadow filter ────────────────────────────────────────────────────────

function shadowFilter(id: string, blur = 8, opacity = 0.85): string {
  return `
    <filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="${blur}"
                   flood-color="#000" flood-opacity="${opacity}"/>
    </filter>
  `;
}

// ── Slide builders ────────────────────────────────────────────────────────────

/**
 * Build a single narrative slide.
 *
 * @param slideType  - "hook" | "context" | "detail" | "cta"
 * @param text       - Main text content for this slide
 * @param slideNum   - 1-indexed position (for progress bar)
 * @param totalSlides - Total number of slides (typically 4)
 * @param bgImagePath - Optional OG image path (used as treated background)
 * @param outPath    - Output PNG file path
 */
export async function buildNarrativeSlide(opts: {
  slideType: SlideType;
  text: string;
  slideNum: number;
  totalSlides: number;
  bgImagePath: string | null;
  outPath: string;
}): Promise<void> {
  const { slideType, text, slideNum, totalSlides, bgImagePath, outPath } = opts;
  const { accent, label } = SLIDE_COLORS[slideType];

  // Build background
  const bgBuffer = await buildBackground(bgImagePath, accent);

  // Main text — centered vertically in the middle zone (below header, above progress)
  const textZoneTop = 220;
  const textZoneBottom = SLIDE_H - 160;
  const textZoneH = textZoneBottom - textZoneTop;

  const fontSize = text.length > 60 ? 72 : text.length > 40 ? 84 : 96;
  const maxChars = text.length > 60 ? 18 : 16;
  const lineH = fontSize * 1.3;
  const lines = wrapText(text, maxChars);
  const blockH = lines.length * lineH;
  const textStartY = textZoneTop + (textZoneH - blockH) / 2;

  const { svg: mainText } = textBlock(text, {
    fontSize,
    maxChars,
    lineHeight: lineH,
    startY: textStartY,
    filterRef: "url(#textShadow)",
  });

  // Compose all SVG layers
  const overlaySvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${shadowFilter("textShadow", 10, 0.9)}
      </defs>

      ${brandHeader(accent)}
      ${slideLabelBadge(label, accent)}
      ${accentLine(textStartY - 20, textStartY + blockH + 20, accent)}
      ${mainText}
      ${progressBar(slideNum, totalSlides, accent)}
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}

// ── Legacy exports kept for compatibility ─────────────────────────────────────
// These are still used by the instagram_reel path and subtitle path in video-gen.ts

/**
 * @deprecated Use buildNarrativeSlide instead for new content.
 * Kept for YouTube source (transcript) and Instagram paths.
 */
export async function buildTitleSlide(opts: {
  title: string;
  outPath: string;
}): Promise<void> {
  await buildNarrativeSlide({
    slideType: "hook",
    text: opts.title,
    slideNum: 1,
    totalSlides: 4,
    bgImagePath: null,
    outPath: opts.outPath,
  });
}

export async function buildSubtitleSlide(opts: {
  text: string;
  slideNum: number;
  totalSlides: number;
  outPath: string;
}): Promise<void> {
  const { text, slideNum, totalSlides, outPath } = opts;
  const accent = C.blue;

  const bgBuffer = await buildBackground(null, accent);
  const lineH = 100;
  const lines = wrapText(text, 22);
  const blockH = lines.length * lineH;
  const textStartY = (SLIDE_H - blockH) / 2;

  const { svg: mainText } = textBlock(text, {
    fontSize: 88,
    maxChars: 22,
    lineHeight: lineH,
    startY: textStartY,
    filterRef: "url(#textShadow)",
  });

  const overlaySvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>${shadowFilter("textShadow", 8, 0.9)}</defs>
      ${brandHeader(accent)}
      ${accentLine(textStartY - 20, textStartY + blockH + 20, accent)}
      ${mainText}
      ${progressBar(slideNum, totalSlides, accent)}
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}

export async function buildContentSlide(opts: {
  text: string;
  bgImagePath: string | null;
  slideNum: number;
  totalSlides: number;
  outPath: string;
}): Promise<void> {
  await buildNarrativeSlide({
    slideType: "context",
    text: opts.text,
    slideNum: opts.slideNum,
    totalSlides: opts.totalSlides,
    bgImagePath: opts.bgImagePath,
    outPath: opts.outPath,
  });
}

export async function buildInstagramSlide(opts: {
  text: string;
  bgImagePath: string | null;
  slideNum: number;
  totalSlides: number;
  outPath: string;
  isLast?: boolean;
  hashtags?: string;
}): Promise<void> {
  const { text, bgImagePath, slideNum, totalSlides, outPath, isLast, hashtags } = opts;

  const accent = C.igPink;
  const bgBuffer = await buildBackground(bgImagePath, accent);

  const lineH = 108;
  const lines = wrapText(text, 20);
  const blockH = lines.length * lineH;
  const textZoneTop = 240;
  const textZoneBottom = SLIDE_H - 180;
  const textStartY = textZoneTop + (textZoneBottom - textZoneTop - blockH) / 2;

  const { svg: mainText } = textBlock(text, {
    fontSize: 90,
    maxChars: 20,
    lineHeight: lineH,
    startY: textStartY,
    filterRef: "url(#textShadow)",
  });

  const ctaSvg = isLast && hashtags
    ? `<text x="${SLIDE_W / 2}" y="${SLIDE_H - 130}" font-family="sans-serif"
         font-size="34" fill="${C.igPink}" text-anchor="middle" font-weight="600">
         ${esc(hashtags.split(" ").slice(0, 4).join(" "))}
       </text>
       <text x="${SLIDE_W / 2}" y="${SLIDE_H - 82}" font-family="sans-serif"
         font-size="28" fill="${C.muted}" text-anchor="middle">Follow for more</text>`
    : "";

  const overlaySvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${shadowFilter("textShadow", 10, 0.9)}
        <linearGradient id="igTopBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="${C.igPurple}"/>
          <stop offset="50%"  stop-color="${C.igPink}"/>
          <stop offset="100%" stop-color="${C.igRed}"/>
        </linearGradient>
      </defs>
      <!-- IG gradient header bar -->
      <rect x="0" y="0" width="${SLIDE_W}" height="140" fill="url(#igTopBar)"/>
      <text x="${SLIDE_W / 2}" y="88" font-family="sans-serif" font-size="36"
            font-weight="700" fill="${C.white}" text-anchor="middle" letter-spacing="4">
        TECH NEWS
      </text>
      <text x="${SLIDE_W - 56}" y="88" font-family="sans-serif" font-size="28"
            fill="${C.white}" text-anchor="end" opacity="0.7">
        ${slideNum}/${totalSlides}
      </text>
      ${mainText}
      ${ctaSvg}
      ${progressBar(slideNum, totalSlides, accent)}
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}

// ── List slide (9:16) — "Did you know?" style ─────────────────────────────────

/**
 * Build a single 9:16 slide for the "Did you know?" / numbered list style.
 *
 * - HOOK slide:  Large punchy text centered, accent color glow
 * - ITEM slide:  Number watermark + pill badge, item text large
 * - CTA slide:   Question centered, green accent, "Comment below" sub-label
 */
export async function buildListSlide(opts: {
  slideType: "hook" | "item" | "cta";
  text: string;
  itemNumber?: number;
  slideNum: number;
  totalSlides: number;
  bgImagePath: string | null;
  outPath: string;
}): Promise<void> {
  const { slideType, text, itemNumber, slideNum, totalSlides, bgImagePath, outPath } = opts;

  const accent =
    slideType === "hook" ? C.orange :
    slideType === "cta"  ? C.green  :
    C.blue;

  const bgBuffer = await buildBackground(bgImagePath, accent);

  const numberBadge = slideType === "item" && itemNumber != null
    ? `
      <text x="90" y="330" font-family="sans-serif" font-size="220" font-weight="900"
            fill="${accent}" opacity="0.12" text-anchor="start">${itemNumber}</text>
      <rect x="60" y="240" width="80" height="80" rx="20"
            fill="${accent}" opacity="0.2"/>
      <text x="100" y="298" font-family="sans-serif" font-size="52" font-weight="900"
            fill="${accent}" text-anchor="middle">${itemNumber}</text>
    `
    : "";

  const ctaLabel = slideType === "cta"
    ? `<text x="${SLIDE_W / 2}" y="${SLIDE_H - 160}" font-family="sans-serif"
         font-size="32" fill="${C.muted}" text-anchor="middle" letter-spacing="3">
         COMMENT BELOW
       </text>`
    : "";

  const textZoneTop = slideType === "item" ? 360 : 280;
  const textZoneBottom = SLIDE_H - 200;
  const textZoneH = textZoneBottom - textZoneTop;

  const fontSize = text.length > 70 ? 68 : text.length > 50 ? 78 : text.length > 30 ? 88 : 96;
  const maxChars = text.length > 60 ? 20 : 18;
  const lineH = fontSize * 1.3;
  const lines = wrapText(text, maxChars);
  const blockH = lines.length * lineH;
  const textStartY = textZoneTop + (textZoneH - blockH) / 2;

  const { svg: mainText } = textBlock(text, {
    fontSize,
    maxChars,
    lineHeight: lineH,
    startY: textStartY,
    filterRef: "url(#textShadow)",
  });

  const overlaySvg = `
    <svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>${shadowFilter("textShadow", 10, 0.9)}</defs>
      ${brandHeader(accent)}
      ${numberBadge}
      ${accentLine(textStartY - 20, textStartY + blockH + 20, accent)}
      ${mainText}
      ${ctaLabel}
      ${progressBar(slideNum, totalSlides, accent)}
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}

// ── Carousel slide (1080×1080) — Instagram feed post ─────────────────────────

export const CAROUSEL_W = 1080;
export const CAROUSEL_H = 1080;

const CAROUSEL_ACCENTS = [C.orange, C.blue, C.cyan, C.green, C.orange, C.blue];

/**
 * Build a 1080×1080 Instagram carousel tile.
 *
 * Slide types:
 *   "cover"  — Bold hook, large text, OG image bg or gradient
 *   "item"   — Numbered fact, ghost number watermark, clean layout
 *   "outro"  — CTA + "Follow for more", branded footer
 */
export async function buildCarouselSlide(opts: {
  slideType: "cover" | "item" | "outro";
  text: string;
  itemNumber?: number;
  slideNum: number;
  totalSlides: number;
  bgImagePath: string | null;
  outPath: string;
}): Promise<void> {
  const { slideType, text, itemNumber, slideNum, totalSlides, bgImagePath, outPath } = opts;

  const accent = CAROUSEL_ACCENTS[(slideNum - 1) % CAROUSEL_ACCENTS.length];
  const W = CAROUSEL_W;
  const H = CAROUSEL_H;

  // Background
  let bgBuffer: Buffer;
  if (bgImagePath && fs.existsSync(bgImagePath) && slideType === "cover") {
    const overlay = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${W}" height="${H}" fill="rgba(5,8,20,0.75)"/>
        <defs>
          <linearGradient id="tint" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.2"/>
            <stop offset="60%" stop-color="${accent}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#tint)"/>
      </svg>`;
    bgBuffer = await sharp(bgImagePath)
      .resize(W, H, { fit: "cover", position: "centre" })
      .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
      .png()
      .toBuffer();
  } else {
    const gradSvg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="main" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${C.bgMid}"/>
            <stop offset="100%" stop-color="${C.bgDeep}"/>
          </linearGradient>
          <radialGradient id="glow" cx="80%" cy="20%" r="60%">
            <stop offset="0%"   stop-color="${accent}" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
          </radialGradient>
          <pattern id="dots" width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="24" cy="24" r="1" fill="${accent}" opacity="0.07"/>
          </pattern>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#main)"/>
        <rect width="${W}" height="${H}" fill="url(#glow)"/>
        <rect width="${W}" height="${H}" fill="url(#dots)"/>
      </svg>`;
    bgBuffer = await sharp(Buffer.from(gradSvg)).png().toBuffer();
  }

  const numBadge = slideType === "item" && itemNumber != null
    ? `
      <text x="${W - 60}" y="${H - 80}" font-family="sans-serif" font-size="260"
            font-weight="900" fill="${accent}" opacity="0.07" text-anchor="end">${itemNumber}</text>
      <circle cx="90" cy="90" r="52" fill="${accent}" opacity="0.2"/>
      <text x="90" y="106" font-family="sans-serif" font-size="58" font-weight="900"
            fill="${accent}" text-anchor="middle">${itemNumber}</text>
    `
    : "";

  const topBar = `<rect x="0" y="0" width="${W}" height="12" fill="${accent}"/>`;

  const brand = `
    <text x="${W / 2}" y="72" font-family="sans-serif" font-size="24" font-weight="700"
          fill="${accent}" text-anchor="middle" letter-spacing="4" opacity="0.8">TECH NEWS</text>
  `;

  const swipeHint = slideNum < totalSlides
    ? `<text x="${W - 36}" y="${H / 2 + 60}" font-family="sans-serif" font-size="24"
         fill="${C.muted}" text-anchor="middle" opacity="0.4"
         transform="rotate(90, ${W - 36}, ${H / 2})">swipe</text>`
    : "";

  const outroExtras = slideType === "outro"
    ? `
      <text x="${W / 2}" y="${H - 100}" font-family="sans-serif" font-size="30"
            fill="${C.muted}" text-anchor="middle" letter-spacing="2">Follow for more tech news</text>
      <rect x="${W / 2 - 100}" y="${H - 76}" width="200" height="3" rx="1.5" fill="${accent}" opacity="0.4"/>
    `
    : "";

  const textZoneTop = slideType === "item" ? 160 : 110;
  const textZoneBottom = slideType === "outro" ? H - 200 : H - 100;
  const textZoneH = textZoneBottom - textZoneTop;

  const fontSize = text.length > 80 ? 52 : text.length > 60 ? 60 : text.length > 40 ? 68 : 76;
  const maxChars = text.length > 70 ? 22 : 20;
  const lineH = fontSize * 1.35;
  const lines = wrapText(text, maxChars);
  const blockH = lines.length * lineH;
  const textStartY = textZoneTop + (textZoneH - blockH) / 2;

  const { svg: mainText } = textBlock(text, {
    fontSize,
    maxChars,
    lineHeight: lineH,
    centerX: W / 2,
    startY: textStartY,
    filterRef: "url(#textShadow)",
  });

  const dotsY = H - 44;
  const dotSpacing = 20;
  const dotsStartX = W / 2 - ((totalSlides - 1) * dotSpacing) / 2;
  const progressDots = Array.from({ length: totalSlides }, (_, i) => {
    const cx = dotsStartX + i * dotSpacing;
    const active = i < slideNum;
    return `<circle cx="${cx}" cy="${dotsY}" r="${active ? 5 : 3}"
      fill="${active ? accent : "rgba(255,255,255,0.15)"}"/>`;
  }).join("");

  const leftBar = `<rect x="0" y="${textStartY - 10}" width="5" height="${blockH + 20}"
    rx="2.5" fill="${accent}" opacity="0.85"/>`;

  const overlaySvg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>${shadowFilter("textShadow", 8, 0.9)}</defs>
      ${topBar}
      ${brand}
      ${numBadge}
      ${leftBar}
      ${mainText}
      ${outroExtras}
      ${swipeHint}
      ${progressDots}
    </svg>
  `;

  await sharp(bgBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}
