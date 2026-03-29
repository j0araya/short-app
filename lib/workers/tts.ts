/**
 * TTS worker — ElevenLabs
 *
 * Converts text to speech using the ElevenLabs REST API.
 * Returns the path to a local MP3 file saved in /tmp/short-app/.
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY
 *   ELEVENLABS_VOICE_ID  (optional — defaults to "Rachel", a neutral English voice)
 */

import fs from "fs";
import path from "path";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export interface TTSResult {
  audioPath: string;
  durationSeconds: number;
}

function getTmpDir(): string {
  const dir = path.join("/tmp", "short-app");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Rough estimate: average English speech ~2.5 words/sec.
 * Good enough for FFmpeg duration — actual duration comes from the MP3.
 */
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 2.5);
}

export async function generateTTS(
  jobId: string,
  text: string,
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set in .env");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`;

  console.log(
    `[tts] generating audio for job ${jobId} — "${text.slice(0, 60)}…"`,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[tts] ElevenLabs API error ${res.status}: ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const audioPath = path.join(getTmpDir(), `${jobId}.mp3`);
  fs.writeFileSync(audioPath, buffer);

  console.log(`[tts] saved to ${audioPath}`);

  return {
    audioPath,
    durationSeconds: estimateDuration(text),
  };
}
