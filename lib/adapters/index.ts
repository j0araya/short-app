/**
 * Adapter factory
 *
 * Maps platform string → PlatformAdapter instance.
 * To register a new platform: import its adapter class and add an entry here.
 */

import type { PlatformAdapter } from "./types";
import { YouTubeAdapter } from "./youtube";

const adapters: Record<string, PlatformAdapter> = {
  youtube: new YouTubeAdapter(),
  // tiktok: new TikTokAdapter(),      // add in v2
  // instagram: new InstagramAdapter(), // add in v3
};

export function getAdapter(platform: string): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(
      `No adapter registered for platform "${platform}". ` +
        `Register it in lib/adapters/index.ts.`
    );
  }
  return adapter;
}
