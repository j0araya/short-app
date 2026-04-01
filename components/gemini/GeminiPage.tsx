"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type GenerateState = "idle" | "generating" | "done" | "error";

interface GenerateResult {
  videoId: string;
  driveWebViewLink: string;
}

// ── Prompt suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "A futuristic city at night with neon lights reflecting on wet streets, cinematic 9:16",
  "A lone astronaut walking on Mars at golden hour, dust swirling around their boots",
  "Abstract data visualization — glowing particles forming neural network connections in deep space",
  "A robot hand delicately assembling a circuit board, macro lens, shallow depth of field",
  "Time-lapse of storm clouds forming over a mountain range, dramatic lighting",
];

// ── Veo parameter hints ───────────────────────────────────────────────────────

const VEO_TIPS = [
  { label: "Aspect ratio", value: "9:16 vertical (auto)" },
  { label: "Duration", value: "8 seconds" },
  { label: "Model", value: "veo-2.0-flash-exp" },
  { label: "Platform", value: "Gemini → YouTube" },
];

// ── Phone preview ─────────────────────────────────────────────────────────────

function PhonePreview({ webViewLink }: { webViewLink: string }) {
  const previewUrl = webViewLink.replace("/view", "/preview");
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">
        Preview
      </p>
      <div className="relative w-[200px] bg-black rounded-[28px] border-[5px] border-[var(--color-border)] shadow-2xl overflow-hidden aspect-[9/16]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-[var(--color-border)] rounded-b-xl z-10" />
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          allow="autoplay"
          title="Generated video preview"
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GeminiPage() {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [state, setState] = useState<GenerateState>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  async function handleGenerate() {
    if (!prompt.trim() || state === "generating") return;

    setState("generating");
    setError(null);
    setResult(null);
    setElapsed(0);

    // Tick elapsed time while generating
    const startedAt = Date.now();
    const ticker = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          title: title.trim() || undefined,
        }),
      });

      const data = await res.json() as { videoId?: string; driveWebViewLink?: string; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Error desconocido");

      setResult({ videoId: data.videoId!, driveWebViewLink: data.driveWebViewLink! });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    } finally {
      clearInterval(ticker);
    }
  }

  const canGenerate = prompt.trim().length > 0 && state !== "generating";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">Gemini Veo</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Generá un Short de 8 segundos con Veo 2 a partir de un prompt de texto. El video se sube a Drive y queda listo para revisar y publicar en YouTube.
        </p>
      </div>

      {/* Veo params info strip */}
      <div className="flex flex-wrap gap-4">
        {VEO_TIPS.map((tip) => (
          <div key={tip.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              {tip.label}
            </span>
            <span className="text-xs text-[var(--color-text)]">{tip.value}</span>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start">

        {/* ── Left: form ── */}
        <div className="space-y-5">

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5 uppercase tracking-wider">
              Título del video <span className="normal-case opacity-60">(opcional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: AI City Timelapse"
              disabled={state === "generating"}
              className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5 uppercase tracking-wider">
              Prompt de video <span className="text-red-400">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Describí la escena en detalle. Incluí estilo visual, iluminación, movimiento de cámara, mood…"
              disabled={state === "generating"}
              className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[var(--color-text)] resize-none focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors"
            />
            <p className="text-[10px] text-[var(--color-muted)] mt-1 opacity-60">
              {prompt.length} caracteres
            </p>
          </div>

          {/* Suggestions */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2 opacity-60">
              Sugerencias
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  disabled={state === "generating"}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] disabled:opacity-40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3 rounded-xl text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
          >
            {state === "generating" ? (
              <>
                <span className="animate-spin text-base">⟳</span>
                Generando con Veo 2… {elapsed > 0 && <span className="opacity-70 font-normal">{elapsed}s</span>}
              </>
            ) : state === "done" ? (
              "Generar otro"
            ) : (
              "Generar video"
            )}
          </button>

          {/* Error */}
          {state === "error" && error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              <p className="font-semibold mb-1">Error</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          )}

          {/* Success card */}
          {state === "done" && result && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-green-400">Video generado</p>
              <div className="flex flex-col gap-2">
                <a
                  href={`/review/${result.videoId}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <span>Revisar y publicar en YouTube</span>
                  <span>→</span>
                </a>
                <a
                  href={result.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)] transition-colors"
                >
                  <span>📁 Ver en Google Drive</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: preview or placeholder ── */}
        <div className="flex justify-center lg:justify-start">
          {state === "done" && result ? (
            <PhonePreview webViewLink={result.driveWebViewLink} />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">
                Preview
              </p>
              <div className="relative w-[200px] bg-[var(--color-surface)] rounded-[28px] border-[5px] border-[var(--color-border)] overflow-hidden aspect-[9/16] flex flex-col items-center justify-center gap-3">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-[var(--color-border)] rounded-b-xl z-10" />
                {state === "generating" ? (
                  <>
                    <span className="text-3xl animate-spin text-[var(--color-accent)]">⟳</span>
                    <p className="text-xs text-[var(--color-muted)] text-center px-4">
                      Veo 2 está generando…
                      {elapsed > 0 && (
                        <span className="block mt-1 opacity-60">{elapsed}s</span>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-4xl opacity-10">✦</span>
                    <p className="text-[10px] text-[var(--color-muted)] text-center px-4 opacity-50">
                      El video aparecerá aquí
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
