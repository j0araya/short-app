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

export interface PlatformAdapter {
  readonly platform: string;
  upload(jobId: string, videoPath: string, title: string): Promise<UploadResult>;
  getStats(externalId: string): Promise<PlatformStats>;
}
