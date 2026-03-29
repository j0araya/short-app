"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContentType } from "@/lib/db/models/Job";

interface Candidate {
  _id: string;
  title: string;
  articleUrl: string | null;
  hasVideo: boolean;
  score: number;
  ogImageUrl: string | null;
  source: string;
  status: "new" | "selected" | "skipped";
  createdAt: string;
}

const CONTENT_TYPE_LABELS: Record<ContentType, { label: string; desc: string; icon: string }> = {
  short_video: {
    label: "YouTube Short",
    desc: "9:16 slideshow, subtitles if YouTube source",
    icon: "▶",
  },
  instagram_reel: {
    label: "Instagram Reel",
    desc: "9:16 video with IG-branded slides",
    icon: "⬡",
  },
  instagram_post: {
    label: "Instagram Post",
    desc: "Static image carousel (carrusel)",
    icon: "⊞",
  },
};

const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
];

interface GenerateState {
  loading: boolean;
  error: string | null;
  jobId: string | null;
}

function CandidateCard({
  candidate,
  selected,
  onToggle,
  contentType,
  onContentTypeChange,
  platforms,
  onPlatformsChange,
  generateState,
  onGenerate,
}: {
  candidate: Candidate;
  selected: boolean;
  onToggle: () => void;
  contentType: ContentType;
  onContentTypeChange: (ct: ContentType) => void;
  platforms: string[];
  onPlatformsChange: (p: string[]) => void;
  generateState: GenerateState;
  onGenerate: () => void;
}) {
  const ct = CONTENT_TYPE_LABELS[contentType];
  const isGenerating = generateState.loading;
  const isDone = !!generateState.jobId;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-lg shadow-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/40"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={onToggle}>
        {/* Checkbox */}
        <div
          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
            selected
              ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
              : "border-[var(--color-border)]"
          }`}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        {/* OG image thumbnail */}
        {candidate.ogImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.ogImageUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-[var(--color-border)] flex-shrink-0 flex items-center justify-center">
            <span className="text-2xl">{candidate.hasVideo ? "▶" : "📄"}</span>
          </div>
        )}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-2 leading-snug">
            {candidate.title}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs font-medium text-amber-400">▲ {candidate.score}</span>
            {candidate.hasVideo && (
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">
                YouTube
              </span>
            )}
            <span className="text-xs text-[var(--color-muted)]">
              {new Date(candidate.createdAt).toLocaleDateString()}
            </span>
          </div>
          {candidate.articleUrl && (
            <a
              href={candidate.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-[var(--color-accent)] hover:underline mt-1 block truncate"
            >
              {new URL(candidate.articleUrl).hostname}
            </a>
          )}
        </div>
      </div>

      {/* Options panel — only when selected */}
      {selected && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)]/50 pt-3">
          {/* Content type selector */}
          <div>
            <p className="text-xs font-medium text-[var(--color-muted)] mb-2 uppercase tracking-wider">
              Formato
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((ctKey) => {
                const info = CONTENT_TYPE_LABELS[ctKey];
                return (
                  <button
                    key={ctKey}
                    onClick={() => onContentTypeChange(ctKey)}
                    className={`text-left p-2 rounded-lg border text-xs transition-all ${
                      contentType === ctKey
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                        : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50"
                    }`}
                  >
                    <span className="block text-base mb-0.5">{info.icon}</span>
                    <span className="font-semibold">{info.label}</span>
                    <span className="block text-[10px] opacity-70 leading-tight mt-0.5">
                      {info.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platform selector */}
          <div>
            <p className="text-xs font-medium text-[var(--color-muted)] mb-2 uppercase tracking-wider">
              Plataforma
            </p>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => {
                const active = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (active) {
                        onPlatformsChange(platforms.filter((x) => x !== p.id));
                      } else {
                        onPlatformsChange([...platforms, p.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                        : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          {isDone ? (
            <a
              href={`/review/${generateState.jobId}`}
              className="block w-full text-center px-4 py-2 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors"
            >
              Ver preview →
            </a>
          ) : (
            <button
              onClick={onGenerate}
              disabled={isGenerating || platforms.length === 0}
              className="w-full px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isGenerating
                ? "Generando…"
                : `Generar ${ct.label}`}
            </button>
          )}

          {generateState.error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {generateState.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SelectPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-candidate state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contentTypes, setContentTypes] = useState<Record<string, ContentType>>({});
  const [platforms, setPlatforms] = useState<Record<string, string[]>>({});
  const [generateStates, setGenerateStates] = useState<Record<string, GenerateState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/candidates?status=new&limit=50");
      const data = await res.json() as { candidates: Candidate[] };
      setCandidates(data.candidates ?? []);
    } catch {
      setError("No se pudieron cargar los candidatos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleCandidate(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Set defaults
        if (!contentTypes[id]) {
          setContentTypes((ct) => ({ ...ct, [id]: "short_video" }));
        }
        if (!platforms[id]) {
          setPlatforms((p) => ({ ...p, [id]: ["youtube"] }));
        }
      }
      return next;
    });
  }

  async function handleScrape() {
    setScraping(true);
    try {
      const res = await fetch("/api/candidates/scrape", { method: "POST" });
      const data = await res.json() as { saved: number };
      if (data.saved > 0) await load();
    } catch {
      /* ignore */
    } finally {
      setScraping(false);
    }
  }

  async function handleGenerate(candidateId: string) {
    setGenerateStates((prev) => ({
      ...prev,
      [candidateId]: { loading: true, error: null, jobId: null },
    }));

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          contentType: contentTypes[candidateId] ?? "short_video",
          platforms: platforms[candidateId] ?? ["youtube"],
        }),
      });

      const data = await res.json() as { jobId?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Error al generar");
      }

      setGenerateStates((prev) => ({
        ...prev,
        [candidateId]: { loading: false, error: null, jobId: data.jobId! },
      }));

      // Remove from candidates list
      setCandidates((prev) => prev.filter((c) => c._id !== candidateId));
    } catch (err) {
      setGenerateStates((prev) => ({
        ...prev,
        [candidateId]: {
          loading: false,
          error: err instanceof Error ? err.message : "Error desconocido",
          jobId: null,
        },
      }));
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Seleccionar contenido</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Elegí qué publicar, el formato y la plataforma destino
          </p>
        </div>
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50 transition-colors"
        >
          <span className={scraping ? "animate-spin" : ""}>⟳</span>
          {scraping ? "Buscando…" : "Buscar nuevos posts"}
        </button>
      </div>

      {/* Stats bar */}
      {!loading && candidates.length > 0 && (
        <div className="flex items-center gap-4 mb-6 text-sm text-[var(--color-muted)]">
          <span>{candidates.length} candidatos disponibles</span>
          <span>·</span>
          <span>{selected.size} seleccionados</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 text-[var(--color-muted)] py-12 justify-center">
          <span className="animate-spin text-lg">⟳</span>
          <span className="text-sm">Cargando candidatos…</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          {error}
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-muted)] text-sm mb-4">
            No hay candidatos nuevos.
          </p>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {scraping ? "Buscando…" : "Buscar en Hacker News"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate._id}
              candidate={candidate}
              selected={selected.has(candidate._id)}
              onToggle={() => toggleCandidate(candidate._id)}
              contentType={contentTypes[candidate._id] ?? "short_video"}
              onContentTypeChange={(ct) =>
                setContentTypes((prev) => ({ ...prev, [candidate._id]: ct }))
              }
              platforms={platforms[candidate._id] ?? ["youtube"]}
              onPlatformsChange={(p) =>
                setPlatforms((prev) => ({ ...prev, [candidate._id]: p }))
              }
              generateState={
                generateStates[candidate._id] ?? { loading: false, error: null, jobId: null }
              }
              onGenerate={() => handleGenerate(candidate._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
