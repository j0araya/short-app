/**
 * caption-gen.ts
 *
 * Generates descriptions and hashtags for all platforms (YouTube, Instagram, TikTok).
 * Rule-based — no external AI API needed.
 * Focus: entertaining, curiosity-driven copy. No score references, no article URLs.
 * Hashtags are derived from title keywords + fixed niche tags + platform tags.
 */

// ── Hashtag banks ─────────────────────────────────────────────────────────────

const TECH_HASHTAGS = [
  "#tech", "#technology", "#technews", "#innovation", "#ai",
  "#programming", "#software", "#startup", "#coding", "#developer",
  "#engineering", "#digitaltransformation", "#future", "#machinelearning",
  "#cloudcomputing", "#cybersecurity", "#openai", "#silicon",
];

const YOUTUBE_SHORTS_HASHTAGS = ["#Shorts", "#TechShorts", "#DailyTech", "#LearnOnYouTube"];
const INSTAGRAM_HASHTAGS = ["#reels", "#viral", "#trending", "#fyp", "#techreels"];
const TIKTOK_HASHTAGS = ["#fyp", "#viral", "#tiktoktech", "#learnontiktok"];

/** Keywords → hashtag mapping */
const KEYWORD_MAP: Record<string, string> = {
  ai: "#ArtificialIntelligence",
  gpt: "#ChatGPT",
  llm: "#LLM",
  rust: "#RustLang",
  python: "#Python",
  javascript: "#JavaScript",
  typescript: "#TypeScript",
  linux: "#Linux",
  open: "#OpenSource",
  source: "#OpenSource",
  cloud: "#CloudComputing",
  aws: "#AWS",
  google: "#Google",
  apple: "#Apple",
  microsoft: "#Microsoft",
  meta: "#Meta",
  security: "#CyberSecurity",
  crypto: "#Crypto",
  blockchain: "#Blockchain",
  quantum: "#QuantumComputing",
  robot: "#Robotics",
  data: "#DataScience",
  web: "#WebDev",
  mobile: "#MobileDev",
  github: "#GitHub",
  openai: "#OpenAI",
  nvidia: "#Nvidia",
  startup: "#Startup",
  founder: "#Founder",
  funding: "#VentureCapital",
  ipo: "#IPO",
};

function extractKeywordHashtags(title: string): string[] {
  const lower = title.toLowerCase();
  const found = new Set<string>();

  for (const [keyword, tag] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      found.add(tag);
    }
  }

  return Array.from(found).slice(0, 5);
}

// ── Hook line pool — picked by title length parity ────────────────────────────

const HOOKS = [
  "This is changing everything in tech 👀",
  "Nobody's talking about this enough 🧵",
  "The tech world just shifted — here's why 💡",
  "This one blew up for a reason 🔥",
  "You need to know about this 🚨",
  "This is the story everyone in tech is reading 📖",
  "Wild what's happening in the industry right now 😳",
  "The future just got a little closer 🤖",
];

function pickHook(title: string): string {
  return HOOKS[title.length % HOOKS.length];
}

// ── YouTube ───────────────────────────────────────────────────────────────────

export function generateYouTubeDescription(title: string): string {
  const hook = pickHook(title);

  const lines = [
    `💡 ${title}`,
    "",
    hook,
    "",
    "Subscribe for the best tech stories every day 🚀",
  ];

  return lines.join("\n").trim();
}

export function generateYouTubeHashtags(title: string): string {
  const keywordTags = extractKeywordHashtags(title);
  const baseTags = TECH_HASHTAGS.slice(0, 6);
  const shortsTags = YOUTUBE_SHORTS_HASHTAGS;

  const all = [...new Set([...keywordTags, ...baseTags, ...shortsTags])];
  return all.join(" ");
}

// ── Instagram ─────────────────────────────────────────────────────────────────

export function generateInstagramCaption(title: string): string {
  const hook = pickHook(title);

  const lines = [
    title,
    "",
    hook,
    "",
    "Follow for daily tech 👨‍💻",
  ];

  return lines.join("\n").trim();
}

export function generateInstagramHashtags(title: string): string {
  const keywordTags = extractKeywordHashtags(title);
  const baseTags = TECH_HASHTAGS.slice(0, 8);
  const igTags = INSTAGRAM_HASHTAGS;

  const all = [...new Set([...keywordTags, ...baseTags, ...igTags])];
  return all.join(" ");
}

// ── TikTok ────────────────────────────────────────────────────────────────────

export function generateTikTokDescription(title: string): string {
  const hook = pickHook(title);

  const lines = [
    title,
    "",
    hook,
    "",
    "Follow for more tech 🤖",
  ];

  return lines.join("\n").trim();
}

export function generateTikTokHashtags(title: string): string {
  const keywordTags = extractKeywordHashtags(title);
  const ttTags = TIKTOK_HASHTAGS;
  const baseTags = TECH_HASHTAGS.slice(0, 5);

  const all = [...new Set([...keywordTags, ...ttTags, ...baseTags])];
  return all.join(" ");
}

// ── Legacy aliases (kept for backward compatibility) ─────────────────────────

/** @deprecated Use generateInstagramCaption */
export const generateCaption = generateInstagramCaption;

/** @deprecated Use generateInstagramHashtags */
export const generateHashtags = generateInstagramHashtags;
