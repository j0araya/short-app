/**
 * caption-gen.ts
 *
 * Generates Instagram captions and hashtags from article metadata.
 * Rule-based — no external AI API needed.
 * Hashtags are derived from title keywords + fixed niche tags.
 */

const TECH_HASHTAGS = [
  "#tech", "#technology", "#technews", "#innovation", "#ai",
  "#programming", "#software", "#startup", "#coding", "#developer",
  "#engineering", "#digitaltransformation", "#future", "#machinelearning",
  "#cloudcomputing", "#cybersecurity", "#openai", "#silicon",
];

const SHORTS_HASHTAGS = ["#shorts", "#reels", "#viral", "#trending", "#fyp"];

/** Keywords → hashtag mapping */
const KEYWORD_MAP: Record<string, string> = {
  ai: "#artificialintelligence",
  gpt: "#chatgpt",
  llm: "#llm",
  rust: "#rustlang",
  python: "#python",
  javascript: "#javascript",
  typescript: "#typescript",
  linux: "#linux",
  open: "#opensource",
  source: "#opensource",
  cloud: "#cloudcomputing",
  aws: "#aws",
  google: "#google",
  apple: "#apple",
  microsoft: "#microsoft",
  meta: "#meta",
  security: "#cybersecurity",
  crypto: "#crypto",
  blockchain: "#blockchain",
  quantum: "#quantumcomputing",
  robot: "#robotics",
  data: "#datascience",
  web: "#webdev",
  mobile: "#mobiledev",
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

export function generateCaption(title: string, score: number, articleUrl: string | null): string {
  const scoreLine = score > 0 ? `🔥 ${score} upvotes on Hacker News` : "Trending on Hacker News";
  const lines = [
    title,
    "",
    scoreLine,
    articleUrl ? `🔗 Full story in bio` : "",
    "",
    "Follow for daily tech news 👨‍💻",
  ].filter((l) => l !== undefined);

  return lines.join("\n").trim();
}

export function generateHashtags(title: string): string {
  const keywordTags = extractKeywordHashtags(title);
  const baseTags = TECH_HASHTAGS.slice(0, 8);
  const shortTags = SHORTS_HASHTAGS.slice(0, 3);

  const all = [...new Set([...keywordTags, ...baseTags, ...shortTags])];
  return all.join(" ");
}
