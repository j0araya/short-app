/**
 * scripts/test-ai-caption.ts
 *
 * Tests the AI caption generator with a few sample stories.
 * Usage: npx tsx scripts/test-ai-caption.ts
 */

import "dotenv/config";
import { generateAICaption } from "@/lib/workers/ai-caption";

const SAMPLES = [
  {
    label: "Serious — security",
    title: "Critical vulnerability found in OpenSSH allows remote code execution",
    url: null,
  },
  {
    label: "Entertaining — quirky",
    title: "Founder of GitLab battles cancer by founding more companies",
    url: null,
  },
  {
    label: "Serious — layoffs",
    title: "Intel announces 15,000 layoffs as chip market continues to contract",
    url: null,
  },
  {
    label: "Entertaining — OSS",
    title: "Developer rewrites Postgres in Rust, it's 2x faster and 10x more fun",
    url: null,
  },
];

async function main() {
  for (const sample of SAMPLES) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[${sample.label}]`);
    console.log(`Title: ${sample.title}`);

    const result = await generateAICaption(sample.title, sample.url);

    if (result) {
      console.log(`Tone : ${result.tone}`);
      console.log(`\nDescription:\n${result.description}`);
    } else {
      console.log("FAILED — no result returned");
    }
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
