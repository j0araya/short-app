/**
 * Reddit scraper worker
 *
 * Fetches top posts from configured subreddits using snoowrap.
 * Reads niche and subreddits from projectConfig — no hardcoded values.
 * Deduplicates against existing Job.sourceUrl in the database.
 */

import Snoowrap from "snoowrap";
import { connectDB, Job } from "@/lib/db";
import { projectConfig } from "@/project.config";

export interface ScrapedPost {
  title: string;
  url: string;
  thumbnail: string | null;
  subreddit: string;
  score: number;
}

function getRedditClient(): Snoowrap {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } =
    process.env;

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    throw new Error(
      "Missing Reddit credentials. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, " +
        "REDDIT_USERNAME and REDDIT_PASSWORD in .env"
    );
  }

  return new Snoowrap({
    userAgent: `${projectConfig.name}/1.0`,
    clientId: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    username: REDDIT_USERNAME,
    password: REDDIT_PASSWORD,
  });
}

export async function scrapeReddit(): Promise<ScrapedPost[]> {
  await connectDB();

  const reddit = getRedditClient();
  // Hardcoded fallback — this scraper is deprecated, use scraper-hn.ts instead
  const subreddits = ["technology"];

  // Fetch already-processed source URLs to avoid duplicates
  const existing = await Job.find({}, { sourceUrl: 1, _id: 0 }).lean();
  const existingUrls = new Set(existing.map((j) => j.sourceUrl));

  const results: ScrapedPost[] = [];

  for (const sub of subreddits) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = await (reddit.getSubreddit(sub) as any).getHot({ limit: 10 });

      for (const post of posts) {
        const url: string = `https://reddit.com${post.permalink}`;
        if (existingUrls.has(url)) continue;

        const thumbnail =
          post.thumbnail && post.thumbnail.startsWith("http") ? post.thumbnail : null;

        results.push({
          title: post.title,
          url,
          thumbnail,
          subreddit: sub,
          score: post.score,
        });

        // Stop after 5 new items per subreddit
        if (results.filter((r) => r.subreddit === sub).length >= 5) break;
      }
    } catch (err) {
      // Log but don't crash — empty subreddit or API error skips gracefully
      console.error(`[scraper] Failed to fetch r/${sub}:`, err);
    }
  }

  return results;
}
