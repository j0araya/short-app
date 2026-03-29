/**
 * Hacker News scraper worker
 *
 * Fetches top stories from the Hacker News Firebase API.
 * No authentication required — fully public.
 *
 * API docs: https://github.com/HackerNews/API
 *
 * Deduplicates against existing Job.sourceUrl in the database.
 */

import { connectDB, Job } from "@/lib/db";
import { projectConfig } from "@/project.config";

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

export interface ScrapedPost {
  title: string;
  url: string;
  thumbnail: string | null;
  source: string;
  score: number;
}

interface HNItem {
  id: number;
  title: string;
  url?: string;          // external link (absent for "Ask HN", "Show HN" with no link)
  score: number;
  type: string;
  deleted?: boolean;
  dead?: boolean;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 0 } } as RequestInit);
  if (!res.ok) throw new Error(`HN API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export async function scrapeHN(): Promise<ScrapedPost[]> {
  await connectDB();

  const { hn } = projectConfig;
  const feed = hn.feed; // "topstories" | "newstories" | "beststories"
  const limit = hn.limit;

  // Fetch already-processed source URLs to avoid duplicates
  const existing = await Job.find({}, { sourceUrl: 1, _id: 0 }).lean();
  const existingUrls = new Set(existing.map((j) => j.sourceUrl));

  // Get list of top story IDs
  const ids = await fetchJSON<number[]>(`${HN_BASE}/${feed}.json`);

  const results: ScrapedPost[] = [];

  for (const id of ids) {
    if (results.length >= limit) break;

    try {
      const item = await fetchJSON<HNItem>(`${HN_BASE}/item/${id}.json`);

      // Skip deleted, dead, or non-story items
      if (!item || item.deleted || item.dead || item.type !== "story") continue;

      // Skip items without an external URL (Ask HN, etc.)
      if (!item.url) continue;

      const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;
      if (existingUrls.has(hnUrl)) continue;

      results.push({
        title: item.title,
        url: hnUrl,
        thumbnail: null, // HN has no thumbnails — video-gen will use solid bg
        source: "hackernews",
        score: item.score,
      });
    } catch (err) {
      console.warn(`[scraper/hn] failed to fetch item ${id}:`, err);
    }
  }

  return results;
}
