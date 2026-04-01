/**
 * ai-caption.ts
 *
 * Uses a local Ollama model (gemma3:4b by default) via the OpenAI-compatible
 * API to generate a short, platform-appropriate description for a tech news
 * story. The tone adapts to the content: serious for funding/security/policy
 * news, lighter for quirky or entertaining stories.
 *
 * Output: plain text, no emojis, 2–4 sentences max, no references to
 * point counts, upvotes, or source sites.
 *
 * Falls back to null on any error — callers should use the rule-based
 * caption-gen as fallback.
 *
 * Env vars (all optional — defaults work out of the box with Ollama):
 *   OLLAMA_BASE_URL   default: http://localhost:11434/v1
 *   OLLAMA_MODEL      default: gemma3:4b
 */

import OpenAI from "openai";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: OLLAMA_BASE_URL,
      apiKey: "ollama", // required by the SDK but ignored by Ollama
    });
  }
  return client;
}

const SYSTEM_PROMPT = `You write short descriptions for tech news short-form videos (YouTube Shorts, TikToks, Instagram Reels).

CRITICAL: Respond with ONLY the description text. No options, no headers, no markdown, no "Option 1", no "**bold**", no explanations. Just the description itself.

Rules:
- Exactly 2 to 4 sentences
- Plain text only — no emojis, no hashtags, no bullet points, no markdown formatting
- Do NOT mention Hacker News, upvotes, points, or any source site
- Do NOT include links or URLs
- Do NOT offer multiple versions or options — write ONE description only
- Default tone is entertaining and curious — make it sound interesting, not like a news headline
- Only use a serious tone for: security breaches, mass layoffs, regulation bans, lawsuits, geopolitical conflict
- Write in second or third person, as if presenting the story to someone who hasn't heard it
- Start with the most interesting or surprising aspect of the story — do NOT use clickbait hooks like "You won't believe", "This is insane", "Wait until you hear"
- End with why it matters or what makes it worth paying attention to`;

export interface AICaptionResult {
  description: string;
  tone: "serious" | "entertaining";
}

const MAX_RETRIES = 2;

/**
 * Stricter follow-up prompt used when the first attempt fails validation.
 * Being more explicit about what NOT to do tends to work better on retry.
 */
const RETRY_PROMPT = `Your previous response was rejected. Here are the specific problems:
- Do NOT start with phrases like "You won't believe", "This is insane", "Wait until you hear", "Imagine", "Guess what"
- Do NOT output multiple options or headers like "Option 1", "Option 2"
- Do NOT use any markdown formatting — no **, no ##, no *, no ---
- Do NOT use quotation marks around the whole description

Write ONE plain-text description, 2–4 sentences. Start directly with the subject or the most interesting fact. No hooks. No intros. No meta-commentary.`;

export async function generateAICaption(
  title: string,
  articleUrl: string | null
): Promise<AICaptionResult | null> {
  try {
    const openai = getClient();

    // Optionally fetch a snippet of the article to give the model more context
    let articleSnippet = "";
    if (articleUrl) {
      articleSnippet = await fetchArticleSnippet(articleUrl);
    }

    const userContent = articleSnippet
      ? `Title: ${title}\n\nArticle excerpt:\n${articleSnippet}`
      : `Title: ${title}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    let description: string | null = null;
    let lastRaw = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Inject previous bad output + retry instructions into the conversation
        messages.push({ role: "assistant", content: lastRaw });
        messages.push({ role: "user", content: RETRY_PROMPT });
        console.warn(`[ai-caption] Attempt ${attempt + 1}: retrying after bad output`);
      }

      const response = await openai.chat.completions.create({
        model: OLLAMA_MODEL,
        temperature: attempt === 0 ? 0.7 : 0.4, // lower temp on retries
        max_tokens: 200,
        messages,
      });

      lastRaw = response.choices[0]?.message?.content?.trim() ?? "";
      if (!lastRaw) continue;

      const cleaned = cleanDescription(lastRaw);
      if (!cleaned) continue;

      const issues = validateDescription(cleaned);
      if (issues.length === 0) {
        description = cleaned;
        break;
      }

      console.warn(`[ai-caption] Attempt ${attempt + 1} failed validation: ${issues.join(", ")}`);
    }

    if (!description) {
      console.error("[ai-caption] All attempts failed validation — returning null");
      return null;
    }

    const tone = detectTone(title, description);
    return { description, tone };
  } catch (err) {
    console.error("[ai-caption] call failed (will use fallback):", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strips Markdown formatting and "Option N" multi-response patterns that some
 * local models (gemma3, llama) produce despite being told not to. Returns the
 * first clean paragraph that looks like a real description (≥ 20 chars).
 */
function cleanDescription(raw: string): string {
  // If model returned "Option 1 ..." style output, extract the first quoted block
  // e.g. "**Option 1 (Serious)**\n\n\"The actual text.\""
  const quotedMatch = raw.match(/"([^"]{20,})"/);
  if (quotedMatch) return quotedMatch[1].trim();

  // Strip markdown: headers, bold/italic markers, horizontal rules
  let cleaned = raw
    .replace(/^#+\s.*$/gm, "")           // ## headings
    .replace(/\*\*[^*]+\*\*/g, (m) => m.slice(2, -2))  // **bold** → text
    .replace(/\*([^*]+)\*/g, "$1")        // *italic* → text
    .replace(/^[-*_]{3,}$/gm, "")         // --- horizontal rules
    .replace(/^>\s/gm, "")               // blockquotes
    .replace(/^\s*[-*+]\s/gm, "")        // list bullets
    .replace(/^Option \d+[^:\n]*:?\s*/gim, "") // "Option 1 (Serious Tone - ~40 seconds)"
    .replace(/\([^)]*tone[^)]*\)/gi, "")  // "(Serious Tone - ~40 seconds)"
    .replace(/\([^)]*seconds[^)]*\)/gi, "") // "(~30 seconds)"
    .trim();

  // Split into paragraphs, take the first non-empty one with substance
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 20);

  return paragraphs[0] ?? cleaned.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

// Clickbait openers and structural problems that indicate a bad generation
const BAD_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "clickbait hook",     re: /^(you won't believe|this is insane|wait until|imagine |guess what|hold on|oh my|holy)/i },
  { label: "clickbait hook",     re: /^(breaking:|just in:|alert:|wow,|seriously,)/i },
  { label: "multiple options",   re: /\b(option [12]|version [12]|tone [12])\b/i },
  { label: "markdown header",    re: /^#{1,4}\s/m },
  { label: "bold markdown",      re: /\*\*[^*]+\*\*/ },
  { label: "option label",       re: /^\*\*option/im },
  { label: "meta commentary",    re: /\b(here('s| is) (a |the )?(description|caption|version|option))\b/i },
  { label: "self-reference",     re: /\b(as (requested|asked)|here you go|sure[,!])\b/i },
  { label: "too short",          re: /^[\s\S]{0,30}$/ }, // less than ~30 chars is not a real description
];

/**
 * Returns an array of issue labels if the description has known bad patterns.
 * Empty array = description is clean.
 */
function validateDescription(text: string): string[] {
  const issues: string[] = [];
  for (const { label, re } of BAD_PATTERNS) {
    if (re.test(text)) {
      issues.push(label);
    }
  }
  return issues;
}

/**
 * Fetches the first ~800 chars of visible text from the article URL.
 * Best-effort — returns empty string on any failure.
 */
async function fetchArticleSnippet(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; short-app/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";

    const html = await res.text();

    // Strip tags, collapse whitespace, take first 800 chars
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    return text;
  } catch {
    return "";
  }
}

// Only hard-serious topics — illness/health stories can still be told with curiosity
const SERIOUS_KEYWORDS = [
  "breach", "hack", "vulnerab", "lawsuit", "ban", "regulat",
  "mass layoff", "arrested", "fine", "sanction", "geopolit", "war",
  "privacy violation", "surveillance", "exploit", "ransom", "leak",
  "bankrupt", "fraud", "scam",
];

function detectTone(title: string, description: string): "serious" | "entertaining" {
  const combined = (title + " " + description).toLowerCase();
  const isSerious = SERIOUS_KEYWORDS.some((kw) => combined.includes(kw));
  return isSerious ? "serious" : "entertaining";
}
