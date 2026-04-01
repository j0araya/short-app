/**
 * PlatformAdapter interface
 *
 * Every platform integration (YouTube, TikTok, Instagram) must implement this interface.
 * The pipeline core only depends on this abstraction — never on a concrete adapter.
 * To add a new platform: create a new file in lib/adapters/ and register it in the factory.
 */

export interface UploadResult {
  externalId: string;
  url: string;
  platform: string;
}

export interface PlatformStats {
  views: number;
  likes: number;
}

/** Optional metadata passed to the adapter at publish time */
export interface UploadMeta {
  /** Pre-generated description/caption for this platform */
  description?: string;
  /** Pre-generated hashtags string, e.g. "#Shorts #tech #AI" */
  hashtags?: string;
}

export interface PlatformAdapter {
  readonly platform: string;
  upload(jobId: string, videoPath: string, title: string, meta?: UploadMeta): Promise<UploadResult>;
  getStats(externalId: string): Promise<PlatformStats>;
}
