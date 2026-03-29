/**
 * Video generation worker (stub)
 *
 * In v1 this returns a mock video path.
 * Replace the body with real FFmpeg + TTS logic when ready.
 *
 * Real implementation outline:
 * 1. Download thumbnail image
 * 2. Generate TTS audio from post title (gTTS or ElevenLabs)
 * 3. Use FFmpeg to compose: image + audio → 9:16 MP4, max 60s
 * 4. Save to /tmp/<jobId>.mp4 and return path
 */

import { projectConfig } from "@/project.config";

export interface VideoGenResult {
  videoPath: string;
  durationSeconds: number;
}

export async function generateVideo(
  jobId: string,
  title: string,
  thumbnail: string | null
): Promise<VideoGenResult> {
  const { durationSeconds } = projectConfig.video;

  // TODO: replace with real FFmpeg pipeline
  console.log(`[video-gen] stub — jobId: ${jobId}, title: "${title}"`);

  const mockPath = `/tmp/${jobId}.mp4`;

  return {
    videoPath: mockPath,
    durationSeconds,
  };
}
