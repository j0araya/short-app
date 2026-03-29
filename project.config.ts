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
  subreddits: ["technology", "programming", "artificial"],
  sources: ["reddit"] as const,
  platforms: ["youtube"] as const,
  schedule: {
    frequency: "2h", // 30m | 1h | 2h | 6h | 12h | 24h
  },
  video: {
    durationSeconds: 60,
    format: "9:16" as const,
    tts: "gtts" as const, // gtts | elevenlabs
  },
};

export const projectConfig = projectConfigSchema.parse(raw);
export type ProjectConfig = typeof projectConfig;
