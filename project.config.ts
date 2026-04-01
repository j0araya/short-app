/**
 * project.config.ts
 *
 * Central configuration for this pipeline instance.
 * Edit this file to adapt the pipeline to a different niche, source, or platform.
 * No changes to core library code should be needed when switching projects.
 */

import { projectConfigSchema } from "@/lib/config/schema";

const raw = {
  name: "short-app",
  niche: "tech-news",
  sources: ["hackernews"] as const,
  hn: {
    feed: "topstories" as const,  // topstories | newstories | beststories
    limit: 20,
  },
  platforms: ["youtube", "gemini"] as const,
  schedule: {
    frequency: "2h", // 30m | 1h | 2h | 6h | 12h | 24h
  },
  video: {
    durationSeconds: 60,
    format: "9:16" as const,
    tts: "elevenlabs" as const, // gtts | elevenlabs
  },
  youtube: {
    privacyStatus: "public" as const,  // public | unlisted | private
    categoryId: "28",                   // 28 = Science & Technology
    tags: ["shorts", "tech", "news", "ai"],
    descriptionTemplate: "{title} #Shorts",
  },
  tiktok: {
    privacyLevel: "SELF_ONLY" as const, // SELF_ONLY | MUTUAL_FOLLOW_FRIENDS | FOLLOWER_OF_CREATOR | PUBLIC_TO_EVERYONE
    disableComment: false,
    disableDuet: false,
    disableStitch: false,
  },
};

export const projectConfig = projectConfigSchema.parse(raw);
export type ProjectConfig = typeof projectConfig;
