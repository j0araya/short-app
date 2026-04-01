/**
 * slide-content.ts
 *
 * Generates slide text for two content styles:
 *
 * "narrative" (default) — 4-slide story arc:
 *   Slide 1 — HOOK:    Bold question or statement (max 10 words)
 *   Slide 2 — CONTEXT: Who/what/when — the essential facts (max 18 words)
 *   Slide 3 — DETAIL:  The surprising number, consequence, or twist (max 18 words)
 *   Slide 4 — CTA:     Engaging question for the viewer (max 10 words)
 *
 * "list" — "Did you know?" numbered list:
 *   Slide 1 — HOOK:     "Did you know X?" or "N things about Y" (max 10 words)
 *   Slides 2–6 — ITEMS: Each item is one short fact (max 14 words each)
 *   Slide last — CTA:   Engaging question / follow prompt (max 10 words)
 */

import OpenAI from "openai";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: "ollama" });
  }
  return client;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type VideoStyle = "narrative" | "list";

export interface NarrativeContent {
  style: "narrative";
  hook: string;
  context: string;
  detail: string;
  cta: string;
}

export interface ListContent {
  style: "list";
  hook: string;         // e.g. "5 things you didn't know about this story"
  items: string[];      // 4–5 short facts, each max 14 words
  cta: string;
}

export type SlideContent = NarrativeContent | ListContent;

// ── Narrative ──────────────────────────────────────────────────────────────────

const NARRATIVE_SYSTEM_PROMPT = `You generate 4 short text lines for a tech news YouTube Short (vertical video).

Each line appears on a separate full-screen slide. Rules per slide:
- HOOK (slide 1): A bold question or statement that makes viewers stay. Max 10 words. No emoji. Example: "This open-source project just beat Google at its own game."
- CONTEXT (slide 2): Who did what. The essential facts. Max 18 words. No emoji. Example: "A solo developer rewrote the entire Postgres engine using Rust in under 6 months."
- DETAIL (slide 3): The surprising number, consequence, or twist. Max 18 words. No emoji. Example: "Benchmarks show it handles 2x more queries per second — with half the memory usage."
- CTA (slide 4): A question that makes the viewer want to comment or share. Max 10 words. No emoji. Example: "Would you switch your database for a 2x speed boost?"

Respond with ONLY a JSON object — no markdown, no explanation:
{"hook":"...","context":"...","detail":"...","cta":"..."}`;

async function fetchNarrativeContent(title: string, snippet: string): Promise<NarrativeContent> {
  const openai = getClient();
  const userContent = snippet
    ? `Title: ${title}\n\nArticle excerpt:\n${snippet}`
    : `Title: ${title}`;

  const response = await openai.chat.completions.create({
    model: OLLAMA_MODEL,
    temperature: 0.6,
    max_tokens: 300,
    messages: [
      { role: "system", content: NARRATIVE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const parsed = JSON.parse(jsonMatch[0]) as Partial<NarrativeContent>;
  if (!parsed.hook || !parsed.context || !parsed.detail || !parsed.cta) {
    throw new Error("Missing required fields in narrative response");
  }

  return {
    style: "narrative",
    hook: parsed.hook.trim(),
    context: parsed.context.trim(),
    detail: parsed.detail.trim(),
    cta: parsed.cta.trim(),
  };
}

function fallbackNarrativeContent(title: string): NarrativeContent {
  const words = title.split(" ");
  const shortTitle = words.slice(0, 8).join(" ") + (words.length > 8 ? "..." : "");
  return {
    style: "narrative",
    hook: shortTitle,
    context: title,
    detail: "This story is making waves in the tech world.",
    cta: "What do you think? Drop a comment below.",
  };
}

// ── List ("Did you know?") ─────────────────────────────────────────────────────

const LIST_SYSTEM_PROMPT = `You generate a "Did you know?" numbered list for a tech news short-form video (YouTube Shorts / Instagram Reels).

Structure:
- HOOK: A curiosity-triggering opener. Use "Did you know..." or "X things about [topic]". Max 10 words. No emoji.
- ITEMS: Exactly 4 short facts from the story. Each fact: max 14 words, starts with a number ("1.", "2.", etc.), no emoji. Make each fact surprising, specific, or counterintuitive.
- CTA: One question that makes viewers want to comment or share. Max 10 words. No emoji.

Example for a story about a new battery technology:
{
  "hook": "Did you know this battery charges 10x faster than lithium?",
  "items": [
    "1. The new sodium battery charges fully in under 4 minutes.",
    "2. It costs 40% less to manufacture than standard lithium cells.",
    "3. It works in extreme cold where lithium batteries completely fail.",
    "4. A single charge can power an EV for 500 miles."
  ],
  "cta": "Would you buy a car with this battery technology?"
}

Respond with ONLY a JSON object — no markdown, no explanation:
{"hook":"...","items":["1. ...","2. ...","3. ...","4. ..."],"cta":"..."}`;

async function fetchListContent(title: string, snippet: string): Promise<ListContent> {
  const openai = getClient();
  const userContent = snippet
    ? `Title: ${title}\n\nArticle excerpt:\n${snippet}`
    : `Title: ${title}`;

  const response = await openai.chat.completions.create({
    model: OLLAMA_MODEL,
    temperature: 0.65,
    max_tokens: 400,
    messages: [
      { role: "system", content: LIST_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in list response");

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ListContent>;
  if (!parsed.hook || !Array.isArray(parsed.items) || parsed.items.length < 2 || !parsed.cta) {
    throw new Error("Missing required fields in list response");
  }

  return {
    style: "list",
    hook: parsed.hook.trim(),
    items: parsed.items.slice(0, 5).map((s) => String(s).trim()),
    cta: parsed.cta.trim(),
  };
}

function fallbackListContent(title: string): ListContent {
  const words = title.split(" ");
  const topic = words.slice(0, 5).join(" ");
  return {
    style: "list",
    hook: `Did you know this about ${topic}?`,
    items: [
      "1. This story is trending across the tech world right now.",
      "2. Experts are calling it a significant shift in the industry.",
      "3. The implications could affect millions of developers globally.",
      "4. This is just the beginning — more updates are expected soon.",
    ],
    cta: "What's your take on this? Drop a comment below.",
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function generateSlideContent(
  title: string,
  articleSnippet: string,
  style: VideoStyle = "narrative"
): Promise<SlideContent> {
  try {
    if (style === "list") {
      return await fetchListContent(title, articleSnippet);
    }
    return await fetchNarrativeContent(title, articleSnippet);
  } catch (err) {
    console.warn(
      `[slide-content] AI failed (style: ${style}), using fallback:`,
      err instanceof Error ? err.message : err
    );
    if (style === "list") return fallbackListContent(title);
    return fallbackNarrativeContent(title);
  }
}
