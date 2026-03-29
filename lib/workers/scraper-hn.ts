/**
 * Hacker News scraper worker
 *
 * Fetches top stories from the Hacker News Firebase API.
 * No authentication required — fully public.
 *
 * API docs: https://github.com/HackerNews/API
 *
 * Saves new posts as Candidate documents for manual selection in the dashboard.
 * Deduplicates against existing Candidate.sourceUrl + Job.sourceUrl.
 */

import { connectDB, Job, Candidate } from "@/lib/db";
import { projectConfig } from "@/project.config";
import type { ICandidate } from "@/lib/db/models/Candidate";

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

export interface ScrapedPost {
  title: string;
  url: string;         // HN item URL — used as dedup key
  articleUrl: string;  // external article/video URL from the HN item
  hasVideo: boolean;   // true if articleUrl is a YouTube video
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

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/.test(url);
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 0 } } as RequestInit);
  if (!res.ok) throw new Error(`HN API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/** Fetch OG image URL from an article page (non-blocking, best-effort) */
async function fetchOGImageUrl(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; short-app/1.0)" },
      signal: AbortSignal.timeout(6000),
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
    return ogUrl;
  } catch {
    return null;
  }
}

/**
 * Scrape HN and return new posts (not yet in DB).
 * Used by the BullMQ worker for fully-automatic pipeline runs.
 */
export async function scrapeHN(): Promise<ScrapedPost[]> {
  await connectDB();

  const { hn } = projectConfig;
  const feed = hn.feed;
  const limit = hn.limit;

  // Dedup against both Jobs and Candidates
  const [existingJobs, existingCandidates] = await Promise.all([
    Job.find({}, { sourceUrl: 1, _id: 0 }).lean(),
    Candidate.find({}, { sourceUrl: 1, _id: 0 }).lean(),
  ]);
  const existingUrls = new Set([
    ...existingJobs.map((j) => j.sourceUrl),
    ...existingCandidates.map((c) => c.sourceUrl),
  ]);

  const ids = await fetchJSON<number[]>(`${HN_BASE}/${feed}.json`);
  const results: ScrapedPost[] = [];

  for (const id of ids) {
    if (results.length >= limit) break;

    try {
      const item = await fetchJSON<HNItem>(`${HN_BASE}/item/${id}.json`);
      if (!item || item.deleted || item.dead || item.type !== "story") continue;
      if (!item.url) continue;

      const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;
      if (existingUrls.has(hnUrl)) continue;

      const articleUrl = item.url;
      const hasVideo = isYouTubeUrl(articleUrl);

      results.push({
        title: item.title,
        url: hnUrl,
        articleUrl,
        hasVideo,
        thumbnail: null,
        source: "hackernews",
        score: item.score,
      });
    } catch (err) {
      console.warn(`[scraper/hn] failed to fetch item ${id}:`, err);
    }
  }

  return results;
}

/**
 * Scrape HN and persist results as Candidate documents.
 * Called from POST /api/candidates/scrape and the BullMQ worker.
 * Returns the number of new candidates saved.
 */
export async function scrapeAndSaveCandidates(): Promise<{
  saved: number;
  candidates: ICandidate[];
}> {
  const posts = await scrapeHN();
  if (posts.length === 0) return { saved: 0, candidates: [] };

  const saved: ICandidate[] = [];

  for (const post of posts) {
    try {
      // Fetch OG image in parallel — non-blocking
      const ogImageUrl = post.hasVideo ? null : await fetchOGImageUrl(post.articleUrl);

      const candidate = await Candidate.create({
        sourceUrl: post.url,
        title: post.title,
        articleUrl: post.articleUrl,
        hasVideo: post.hasVideo,
        score: post.score,
        ogImageUrl,
        source: post.source,
        status: "new",
      });
      saved.push(candidate);
    } catch (err: unknown) {
      // Duplicate key = already exists — skip silently
      if ((err as { code?: number }).code === 11000) continue;
      console.warn(`[scraper/hn] failed to save candidate for ${post.url}:`, err);
    }
  }

  return { saved: saved.length, candidates: saved };
}
