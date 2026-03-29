import { z } from "zod";

export const projectConfigSchema = z.object({
  name: z.string().min(1),
  niche: z.string().min(1),
  subreddits: z.array(z.string()).min(1),
  sources: z.array(z.enum(["reddit", "trends", "rss"])).min(1),
  platforms: z.array(z.enum(["youtube", "tiktok", "instagram"])).min(1),
  schedule: z.object({
    frequency: z.enum(["30m", "1h", "2h", "6h", "12h", "24h"]),
  }),
  video: z.object({
    durationSeconds: z.number().int().min(15).max(60),
    format: z.literal("9:16"),
    tts: z.enum(["gtts", "elevenlabs"]),
  }),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
