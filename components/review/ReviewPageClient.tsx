"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoDetail {
  _id: string;
  title: string;
  platform: string;
  contentType: "short_video" | "instagram_reel" | "instagram_post";
  publishStatus: "pending_publish" | "published";
  externalId: string;
  driveWebViewLink: string | null;
  driveFileId: string | null;
  instagramCaption: string | null;
  instagramHashtags: string | null;
  sourceArticleUrl: string | null;
  hasVideo: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  jobId: {
    _id: string;
    title: string;
    videoPath: string | null;
    status: string;
    contentType: string;
  };
}

// ─── Platform selector ────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "#ff0000" },
  tiktok: { label: "TikTok", color: "#ff0050" },
  instagram: { label: "Instagram", color: "#E1306C" },
};

function PlatformToggle({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (p: string[]) => void;
}) {
  return (
    <div className="flex gap-2">
      {Object.entries(PLATFORM_CONFIG).map(([id, cfg]) => {
        const active = selected.includes(id);
        return (
          <button
            key={id}
            onClick={() =>
              onChange(active ? selected.filter((x) => x !== id) : [...selected, id])
            }
            style={active ? { borderColor: cfg.color, color: cfg.color } : undefined}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              active
                ? "opacity-100"
                : "border-[var(--color-border)] text-[var(--color-muted)] hover:opacity-80"
            }`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Video preview panel ──────────────────────────────────────────────────────

function VideoPreviewPanel({ video }: { video: VideoDetail }) {
  const jobStatus = video.jobId?.status;
  const isProcessing = jobStatus === "processing" || jobStatus === "pending";

  return (
    <div className="flex flex-col gap-4">
      {/* 9:16 phone frame */}
      <div className="mx-auto w-[240px]">
        <div className="relative bg-black rounded-[28px] border-4 border-[var(--color-border)] overflow-hidden shadow-2xl aspect-[9/16]">
          {video.driveWebViewLink ? (
            <iframe
              src={video.driveWebViewLink.replace("/view", "/preview")}
              className="w-full h-full"
              allow="autoplay"
            />
          ) : isProcessing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-surface)]">
              <span className="text-3xl animate-spin">⟳</span>
              <p className="text-xs text-[var(--color-muted)] text-center px-4">
                Generando video…
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--color-surface)]">
              <span className="text-4xl opacity-30">🎬</span>
              <p className="text-xs text-[var(--color-muted)] text-center px-4">
                Video no disponible
              </p>
              {video.driveWebViewLink && (
                <a
                  href={video.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Abrir en Drive
                </a>
              )}
            </div>
          )}

          {/* Status pill */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                video.publishStatus === "published"
                  ? "bg-green-500/80 text-white"
                  : "bg-amber-500/80 text-white"
              }`}
            >
              {video.publishStatus === "published" ? "Publicado" : "Pendiente"}
            </span>
            <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full font-medium">
              {video.contentType === "short_video"
                ? "YT Short"
                : video.contentType === "instagram_reel"
                ? "IG Reel"
                : "IG Post"}
            </span>
          </div>
        </div>
      </div>

      {/* Drive link */}
      {video.driveWebViewLink && (
        <a
          href={video.driveWebViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-center text-[var(--color-accent)] hover:underline"
        >
          Ver en Google Drive
        </a>
      )}

      {/* Source article */}
      {video.sourceArticleUrl && (
        <a
          href={video.sourceArticleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors truncate"
        >
          Fuente: {new URL(video.sourceArticleUrl).hostname}
        </a>
      )}
    </div>
  );
}

// ─── Caption editor ───────────────────────────────────────────────────────────

function CaptionEditor({
  videoId,
  caption,
  hashtags,
  onSaved,
}: {
  videoId: string;
  caption: string | null;
  hashtags: string | null;
  onSaved: (caption: string, hashtags: string) => void;
}) {
  const [captionVal, setCaptionVal] = useState(caption ?? "");
  const [hashtagsVal, setHashtagsVal] = useState(hashtags ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramCaption: captionVal,
          instagramHashtags: hashtagsVal,
        }),
      });
      setSaved(true);
      onSaved(captionVal, hashtagsVal);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5 uppercase tracking-wider">
          Caption
        </label>
        <textarea
          value={captionVal}
          onChange={(e) => setCaptionVal(e.target.value)}
          rows={5}
          className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          placeholder="Caption de Instagram…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5 uppercase tracking-wider">
          Hashtags
        </label>
        <input
          type="text"
          value={hashtagsVal}
          onChange={(e) => setHashtagsVal(e.target.value)}
          className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          placeholder="#tech #ai #shorts…"
        />
        <p className="text-xs text-[var(--color-muted)] mt-1">
          {hashtagsVal.split(" ").filter((h) => h.startsWith("#")).length} hashtags
        </p>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50 transition-all"
      >
        {saved ? "Guardado ✓" : saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}

// ─── Publish section ──────────────────────────────────────────────────────────

function PublishSection({
  video,
  selectedPlatforms,
  onPublished,
}: {
  video: VideoDetail;
  selectedPlatforms: string[];
  onPublished: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);

  if (video.publishStatus === "published") {
    return (
      <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center">
        <p className="text-sm font-semibold text-green-400 mb-1">Publicado</p>
        {video.externalId && (
          <a
            href={`https://youtube.com/shorts/${video.externalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Ver en YouTube →
          </a>
        )}
        {video.publishedAt && (
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {new Date(video.publishedAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  async function handlePublish() {
    if (state === "loading") return;
    setState("loading");
    setError(null);

    // Publish to each selected platform
    const results: { platform: string; ok: boolean; url?: string; error?: string }[] = [];

    for (const platform of selectedPlatforms) {
      if (platform === "youtube" || platform === "tiktok") {
        try {
          const res = await fetch(`/api/videos/${video._id}/publish`, { method: "POST" });
          const data = await res.json() as { url?: string; error?: string };
          if (res.ok) {
            results.push({ platform, ok: true, url: data.url });
            setPublishUrl(data.url ?? null);
          } else {
            results.push({ platform, ok: false, error: data.error });
          }
        } catch (err) {
          results.push({ platform, ok: false, error: String(err) });
        }
      } else {
        // Instagram — manual for now
        results.push({ platform, ok: true }); // treat as "acknowledged"
      }
    }

    const allOk = results.every((r) => r.ok);
    if (allOk) {
      setState("done");
      onPublished();
    } else {
      setState("error");
      setError(results.filter((r) => !r.ok).map((r) => `${r.platform}: ${r.error}`).join("; "));
    }
  }

  return (
    <div className="space-y-3">
      {selectedPlatforms.includes("instagram") && (
        <div className="rounded-lg bg-[#E1306C]/10 border border-[#E1306C]/30 p-3 text-xs text-[#E1306C]">
          Instagram Graph API no está configurada — el video se guarda en Drive para subida manual.
        </div>
      )}

      {selectedPlatforms.includes("tiktok") && (
        <div className="rounded-lg bg-[#ff0050]/10 border border-[#ff0050]/30 p-3 text-xs text-[#ff0050]">
          TikTok — apps no auditadas publican en modo privado (SELF_ONLY) hasta aprobar la auditoría del developer portal.
        </div>
      )}

      <button
        onClick={handlePublish}
        disabled={state === "loading" || selectedPlatforms.length === 0}
        className="w-full py-3 rounded-xl text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {state === "loading"
          ? "Publicando…"
          : state === "done"
          ? "Publicado ✓"
          : `Publicar en ${selectedPlatforms.map((p) => PLATFORM_CONFIG[p]?.label ?? p).join(" + ")}`}
      </button>

      {publishUrl && (
        <a
          href={publishUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-center text-[var(--color-accent)] hover:underline"
        >
          Ver publicación →
        </a>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewPageClient({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube"]);

  // Poll until the video is generated (Drive link becomes available)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchVideo() {
      try {
        // First attempt: look up by Job ID (redirect from /select)
        let res = await fetch(`/api/videos?status=pending_publish&limit=100`);
        const data = await res.json() as { videos: (VideoDetail & { jobId: string | { _id: string } })[] };

        // Find the video that matches this jobId
        let found = data.videos.find(
          (v) =>
            (typeof v.jobId === "string" ? v.jobId : v.jobId?._id) === videoId ||
            v._id === videoId
        );

        if (!found) {
          // Try direct video lookup
          res = await fetch(`/api/videos/${videoId}`);
          if (res.ok) {
            found = await res.json();
          }
        }

        if (found) {
          setVideo(found as unknown as VideoDetail);
          setLoading(false);

          // Determine default platform from contentType
          if (found.contentType === "instagram_reel" || found.contentType === "instagram_post") {
            setSelectedPlatforms(["instagram"]);
          } else {
            setSelectedPlatforms(["youtube"]);
          }

          // Stop polling once we have a Drive link or job is done/failed
          const jobStatus = (found as VideoDetail).jobId?.status;
          if (found.driveWebViewLink || jobStatus === "done" || jobStatus === "failed") {
            if (interval) clearInterval(interval);
          }
        }
      } catch {
        setError("No se pudo cargar el video.");
        setLoading(false);
        if (interval) clearInterval(interval);
      }
    }

    fetchVideo();
    // Poll every 5s while job is processing
    interval = setInterval(fetchVideo, 5000);

    return () => { if (interval) clearInterval(interval); };
  }, [videoId]);

  function handleCaptionSaved(caption: string, hashtags: string) {
    if (video) {
      setVideo({ ...video, instagramCaption: caption, instagramHashtags: hashtags });
    }
  }

  const isIG =
    video?.contentType === "instagram_reel" || video?.contentType === "instagram_post";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back */}
      <a
        href="/select"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        ← Volver a selección
      </a>

      {loading ? (
        <div className="flex items-center gap-3 py-20 justify-center text-[var(--color-muted)]">
          <span className="animate-spin text-xl">⟳</span>
          <span className="text-sm">Cargando…</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          {error}
        </div>
      ) : video ? (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Left — video preview */}
          <div>
            <VideoPreviewPanel video={video} />
          </div>

          {/* Right — metadata + publish */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)] leading-snug">
                {video.title}
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    video.publishStatus === "published"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {video.publishStatus === "published" ? "Publicado" : "Pendiente"}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {video.contentType === "short_video"
                    ? "YouTube Short"
                    : video.contentType === "instagram_reel"
                    ? "Instagram Reel"
                    : "Instagram Post"}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  Creado {new Date(video.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Platform selector */}
            <div>
              <p className="text-xs font-medium text-[var(--color-muted)] mb-2 uppercase tracking-wider">
                Publicar en
              </p>
              <PlatformToggle
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
            </div>

            {/* Caption editor — only for IG content */}
            {isIG && (
              <div>
                <p className="text-xs font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">
                  Caption e Hashtags
                </p>
                <CaptionEditor
                  videoId={video._id}
                  caption={video.instagramCaption}
                  hashtags={video.instagramHashtags}
                  onSaved={handleCaptionSaved}
                />
              </div>
            )}

            {/* Publish */}
            <div>
              <p className="text-xs font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">
                Publicar
              </p>
              <PublishSection
                video={video}
                selectedPlatforms={selectedPlatforms}
                onPublished={() =>
                  setVideo((v) => v ? { ...v, publishStatus: "published" } : v)
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
