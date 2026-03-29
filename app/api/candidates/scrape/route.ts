import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { scrapeAndSaveCandidates } from "@/lib/workers/scraper-hn";

/**
 * POST /api/candidates/scrape
 *
 * Scrapes HN and saves new posts as Candidate documents.
 * Called from the /select page "Refresh" button.
 * Returns the count of newly saved candidates.
 */
export async function POST() {
  await connectDB();

  try {
    const { saved, candidates } = await scrapeAndSaveCandidates();
    return NextResponse.json({
      saved,
      candidates: candidates.map((c) => ({
        _id: c._id,
        title: c.title,
        score: c.score,
        hasVideo: c.hasVideo,
        status: c.status,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/candidates/scrape]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
