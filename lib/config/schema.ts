import { z } from "zod";

export const projectConfigSchema = z.object({
  name: z.string().min(1),
  niche: z.string().min(1),
  sources: z.array(z.enum(["hackernews", "rss"])).min(1),
  hn: z.object({
    feed: z.enum(["topstories", "newstories", "beststories"]).default("topstories"),
    limit: z.number().int().min(1).max(30).default(5),
  }).default({ feed: "topstories", limit: 5 }),
  platforms: z.array(z.enum(["youtube", "tiktok", "instagram"])).min(1),
  schedule: z.object({
    frequency: z.enum(["30m", "1h", "2h", "6h", "12h", "24h"]),
  }),
  video: z.object({
    durationSeconds: z.number().int().min(15).max(60),
    format: z.literal("9:16"),
    tts: z.enum(["gtts", "elevenlabs"]),
  }),
  youtube: z.object({
    /** "public" | "unlisted" | "private" */
    privacyStatus: z.enum(["public", "unlisted", "private"]).default("public"),
    /** YouTube category ID — 28 = Science & Technology */
    categoryId: z.string().default("28"),
    /** Tags added to every upload */
    tags: z.array(z.string()).default([]),
    /** Description template — {title} is replaced with the video title */
    descriptionTemplate: z.string().default("{title} #Shorts"),
  }).default({
    privacyStatus: "public",
    categoryId: "28",
    tags: [],
    descriptionTemplate: "{title} #Shorts",
  }),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
