/**
 * subtitles.ts
 *
 * Fetches the transcript from a YouTube video using youtube-transcript.
 * No API key required — uses the public caption endpoint.
 *
 * Returns an array of subtitle slides: each slide is a chunk of ~20 words
 * suitable for rendering as a text overlay on a 9:16 frame.
 */

import { YoutubeTranscript } from "youtube-transcript";

export interface SubtitleSlide {
  text: string;
  startSec: number;
  durationSec: number;
}

/** Extract the YouTube video ID from a watch URL or youtu.be short URL */
export function extractYouTubeId(url: string): string | null {
  const match =
    url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

/**
 * Fetch transcript and group into slides of ~20 words each.
 * Returns null if transcript is unavailable.
 */
export async function fetchSubtitleSlides(
  videoUrl: string,
  maxSlides = 8
): Promise<SubtitleSlide[] | null> {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return null;

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });

    if (!transcript || transcript.length === 0) return null;

    // Group transcript entries into ~20-word chunks
    const slides: SubtitleSlide[] = [];
    let buffer: string[] = [];
    let slideStart = transcript[0].offset / 1000;
    let slideDuration = 0;

    for (const entry of transcript) {
      const words = entry.text.trim().split(/\s+/);
      buffer.push(...words);
      slideDuration = entry.offset / 1000 + entry.duration / 1000 - slideStart;

      if (buffer.length >= 20) {
        slides.push({
          text: buffer.join(" "),
          startSec: slideStart,
          durationSec: Math.max(slideDuration, 3),
        });
        buffer = [];
        const nextEntry = transcript[transcript.indexOf(entry) + 1];
        slideStart = nextEntry ? nextEntry.offset / 1000 : slideStart + slideDuration;
        slideDuration = 0;

        if (slides.length >= maxSlides) break;
      }
    }

    // Flush remaining words
    if (buffer.length > 0 && slides.length < maxSlides) {
      slides.push({
        text: buffer.join(" "),
        startSec: slideStart,
        durationSec: Math.max(slideDuration, 3),
      });
    }

    return slides.length > 0 ? slides : null;
  } catch {
    return null;
  }
}
