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
  driveFolderId: string | null;
  instagramCaption: string | null;
  instagramHashtags: string | null;
  youtubeDescription: string | null;
  youtubeHashtags: string | null;
  tiktokDescription: string | null;
  tiktokHashtags: string | null;
  sourceArticleUrl: string | null;
  hasVideo: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  jobId: {
    _id: string;
    title: string;
    videoPath: string | null;
    carouselPaths: string[] | null;
    status: string;
    contentType: string;
    videoStyle: string;
    sourceUrl: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  youtube:   { label: "YouTube",   color: "#ff0000" },
  tiktok:    { label: "TikTok",    color: "#ff0050" },
  instagram: { label: "Instagram", color: "#E1306C" },
  gemini:    { label: "Gemini",    color: "#8ab4f8" },
};

function drivePreviewUrl(webViewLink: string): string {
  return webViewLink.replace("/view", "/preview");
}

function driveFilePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// ─── Platform versions config ─────────────────────────────────────────────────

interface PlatformVersion {
  platform: string;
  contentType: "short_video" | "instagram_reel" | "instagram_post";
  videoStyle: "narrative" | "list";
  label: string;
  description: string;
  color: string;
  icon: string;
}

const ALL_PLATFORM_VERSIONS: PlatformVersion[] = [
  {
    platform:    "youtube",
    contentType: "short_video",
    videoStyle:  "narrative",
    label:       "YouTube Short",
    description: "Video vertical 9:16 · hasta 60s",
    color:       "#ff0000",
    icon:        "▶",
  },
  {
    platform:    "tiktok",
    contentType: "short_video",
    videoStyle:  "narrative",
    label:       "TikTok Video",
    description: "Video vertical 9:16 · hasta 60s",
    color:       "#ff0050",
    icon:        "♪",
  },
  {
    platform:    "instagram",
    contentType: "instagram_post",
    videoStyle:  "list",
    label:       "Instagram Post",
    description: "Carrusel de imágenes · slides estáticos",
    color:       "#E1306C",
    icon:        "▦",
  },
  {
    platform:    "instagram",
    contentType: "instagram_reel",
    videoStyle:  "narrative",
    label:       "Instagram Reel",
    description: "Video vertical 9:16 · hasta 60s",
    color:       "#E1306C",
    icon:        "⬡",
  },
];

// ─── Phone frame (9:16) ───────────────────────────────────────────────────────

function PhoneFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">
          {label}
        </p>
      )}
      <div className="relative w-[220px] bg-black rounded-[32px] border-[5px] border-[var(--color-border)] shadow-2xl overflow-hidden aspect-[9/16]">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-[var(--color-border)] rounded-b-xl z-10" />
        <div className="w-full h-full">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Square frame (1:1 Instagram) ────────────────────────────────────────────

function SquareFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">
          {label}
        </p>
      )}
      <div className="relative w-[220px] bg-black rounded-2xl border-[3px] border-[var(--color-border)] shadow-2xl overflow-hidden aspect-square">
        {children}
      </div>
    </div>
  );
}

// ─── Video preview (short_video / instagram_reel) ─────────────────────────────

function VideoPreview({ video, label }: { video: VideoDetail; label?: string }) {
  const jobStatus = video.jobId?.status;
  const isProcessing = jobStatus === "processing" || jobStatus === "pending";

  return (
    <PhoneFrame label={label}>
      {video.driveWebViewLink ? (
        <iframe
          src={drivePreviewUrl(video.driveWebViewLink)}
          className="w-full h-full border-0"
          allow="autoplay"
          title="Video preview"
        />
      ) : isProcessing ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 bg-[var(--color-surface)]">
          <span className="text-3xl animate-spin">⟳</span>
          <p className="text-xs text-[var(--color-muted)] text-center px-4">
            Generando video…
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-2 bg-[var(--color-surface)]">
          <span className="text-4xl opacity-20">🎬</span>
          <p className="text-xs text-[var(--color-muted)] text-center px-4">
            Video no disponible
          </p>
        </div>
      )}
    </PhoneFrame>
  );
}

// ─── Carousel preview (instagram_post) ───────────────────────────────────────

function CarouselPreview({ video }: { video: VideoDetail }) {
  const carouselPaths = video.jobId?.carouselPaths ?? [];
  const totalTiles = carouselPaths.length || 6;
  const [current, setCurrent] = useState(0);
  const jobStatus = video.jobId?.status;
  const isProcessing = jobStatus === "processing" || jobStatus === "pending";

  const firstTilePreviewUrl = video.driveFileId
    ? driveFilePreviewUrl(video.driveFileId)
    : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <SquareFrame label="Instagram Post · Carrusel">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 bg-[var(--color-surface)]">
            <span className="text-3xl animate-spin">⟳</span>
            <p className="text-xs text-[var(--color-muted)] text-center px-4">
              Generando carousel…
            </p>
          </div>
        ) : current === 0 && firstTilePreviewUrl ? (
          <iframe
            src={firstTilePreviewUrl}
            className="w-full h-full border-0"
            allow="autoplay"
            title="Tile 1 preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
            <span className="text-6xl font-black text-white/10 select-none">
              {current + 1}
            </span>
            <p className="text-xs text-white/40">Slide {current + 1} / {totalTiles}</p>
            {video.driveFolderId && (
              <a
                href={`https://drive.google.com/drive/folders/${video.driveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--color-accent)] hover:underline mt-2"
              >
                Ver en Drive →
              </a>
            )}
          </div>
        )}
      </SquareFrame>

      {/* Dot navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="w-7 h-7 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] disabled:opacity-30 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all text-sm"
        >
          ‹
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: totalTiles }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current
                  ? "w-4 h-2 bg-[var(--color-accent)]"
                  : "w-2 h-2 bg-[var(--color-border)] hover:bg-[var(--color-muted)]"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrent((c) => Math.min(totalTiles - 1, c + 1))}
          disabled={current === totalTiles - 1}
          className="w-7 h-7 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] disabled:opacity-30 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all text-sm"
        >
          ›
        </button>
      </div>

      {video.driveFolderId && (
        <a
          href={`https://drive.google.com/drive/folders/${video.driveFolderId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Ver todas las tiles en Drive →
        </a>
      )}
    </div>
  );
}

// ─── Preview dispatcher ───────────────────────────────────────────────────────
// Renders the right preview component for a given video + selected contentType.

function PreviewPanel({
  video,
  previewContentType,
}: {
  video: VideoDetail;
  previewContentType: "short_video" | "instagram_reel" | "instagram_post";
}) {
  if (previewContentType === "instagram_post") {
    return <CarouselPreview video={video} />;
  }

  const labelMap: Record<string, string> = {
    short_video:    "YouTube Short",
    instagram_reel: "Instagram Reel",
  };

  return <VideoPreview video={video} label={labelMap[previewContentType]} />;
}

// ─── Version list (current + missing) ────────────────────────────────────────
// Left-column list that lets the user select which version to preview and
// queue generation for missing ones.

interface VersionRowProps {
  version: PlatformVersion;
  isActive: boolean;
  isCurrent: boolean;
  generateState: "idle" | "loading" | "queued" | "error";
  errorMsg: string;
  onSelect: () => void;
  onGenerate: () => void;
}

function VersionRow({
  version,
  isActive,
  isCurrent,
  generateState,
  errorMsg,
  onSelect,
  onGenerate,
}: VersionRowProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
        isActive
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)]/20"
      }`}
    >
      {/* Icon */}
      <span
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: version.color + "18", color: version.color }}
      >
        {version.icon}
      </span>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)] leading-none mb-0.5">
          {version.label}
        </p>
        <p className="text-xs text-[var(--color-muted)] truncate">
          {version.description}
        </p>
        {errorMsg && (
          <p className="text-xs text-red-400 mt-0.5 truncate">{errorMsg}</p>
        )}
      </div>

      {/* Right badge / action */}
      {isCurrent ? (
        <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
          actual
        </span>
      ) : (
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (generateState === "idle" || generateState === "error") onGenerate();
          }}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all whitespace-nowrap ${
            generateState === "queued"
              ? "border-green-500/40 text-green-400 bg-green-500/10 cursor-default"
              : generateState === "loading"
              ? "border-[var(--color-border)] text-[var(--color-muted)] opacity-60 cursor-wait"
              : generateState === "error"
              ? "border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer"
              : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer"
          }`}
        >
          {generateState === "loading" ? "Encolando…"
            : generateState === "queued"  ? "En cola ✓"
            : generateState === "error"   ? "Reintentar"
            : "Generar"}
        </span>
      )}
    </button>
  );
}

// ─── Description editor ───────────────────────────────────────────────────────

function DescriptionEditor({
  videoId,
  video,
  platform,
  onSaved,
}: {
  videoId: string;
  video: VideoDetail;
  platform: string;
  onSaved: (updates: Partial<VideoDetail>) => void;
}) {
  const [desc, setDesc] = useState(
    platform === "instagram"
      ? (video.instagramCaption ?? "")
      : platform === "tiktok"
      ? (video.tiktokDescription ?? "")
      : (video.youtubeDescription ?? "")
  );
  const [tags, setTags] = useState(
    platform === "instagram"
      ? (video.instagramHashtags ?? "")
      : platform === "tiktok"
      ? (video.tiktokHashtags ?? "")
      : (video.youtubeHashtags ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDesc(
      platform === "instagram"
        ? (video.instagramCaption ?? "")
        : platform === "tiktok"
        ? (video.tiktokDescription ?? "")
        : (video.youtubeDescription ?? "")
    );
    setTags(
      platform === "instagram"
        ? (video.instagramHashtags ?? "")
        : platform === "tiktok"
        ? (video.tiktokHashtags ?? "")
        : (video.youtubeHashtags ?? "")
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (platform === "instagram") {
        body.instagramCaption = desc;
        body.instagramHashtags = tags;
      } else if (platform === "tiktok") {
        body.tiktokDescription = desc;
        body.tiktokHashtags = tags;
      } else {
        body.youtubeDescription = desc;
        body.youtubeHashtags = tags;
      }

      await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      onSaved(body as Partial<VideoDetail>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const descLabel =
    platform === "instagram" ? "Caption" : platform === "tiktok" ? "Descripción" : "Descripción de YouTube";

  const tagCount = tags.split(/\s+/).filter((t) => t.startsWith("#")).length;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5 uppercase tracking-wider">
          {descLabel}
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          placeholder="Descripción…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5 uppercase tracking-wider">
          Hashtags
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          placeholder="#tech #ai #shorts…"
        />
        <p className="text-xs text-[var(--color-muted)] mt-1">{tagCount} hashtags</p>
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
  platform,
  onPublished,
}: {
  video: VideoDetail;
  platform: string;
  onPublished: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);

  if (video.publishStatus === "published") {
    return (
      <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
        <p className="text-sm font-semibold text-green-400 mb-2">Publicado</p>
        {video.externalId && video.platform === "youtube" && (
          <a
            href={`https://youtube.com/shorts/${video.externalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline block"
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

    try {
      if (platform === "youtube" || platform === "tiktok") {
        const res = await fetch(`/api/videos/${video._id}/publish`, { method: "POST" });
        const data = await res.json() as { url?: string; error?: string };
        if (res.ok) {
          setPublishUrl(data.url ?? null);
          setState("done");
          onPublished();
        } else {
          throw new Error(data.error ?? "Error desconocido");
        }
      } else {
        // Instagram / Gemini — manual
        setState("done");
        onPublished();
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const platformLabel = PLATFORM_CONFIG[platform]?.label ?? platform;

  return (
    <div className="space-y-3">
      {platform === "instagram" && (
        <div className="rounded-lg bg-[#E1306C]/10 border border-[#E1306C]/30 p-3 text-xs text-[#E1306C]">
          Instagram Graph API no configurada — el contenido está en Drive para subida manual.
        </div>
      )}
      {platform === "tiktok" && (
        <div className="rounded-lg bg-[#ff0050]/10 border border-[#ff0050]/30 p-3 text-xs text-[#ff0050]">
          TikTok — apps no auditadas publican en modo privado (SELF_ONLY).
        </div>
      )}

      <button
        onClick={handlePublish}
        disabled={state === "loading"}
        className="w-full py-3 rounded-xl text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {state === "loading"
          ? "Publicando…"
          : state === "done"
          ? "Publicado ✓"
          : `Publicar en ${platformLabel}`}
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

// ─── Meta chips ───────────────────────────────────────────────────────────────

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs text-[var(--color-text)]">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewPageClient({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The contentType whose preview is currently shown on the left
  const [activeContentType, setActiveContentType] = useState<
    "short_video" | "instagram_reel" | "instagram_post"
  >("short_video");

  // Per-version generate states for missing versions
  const [genStates, setGenStates] = useState<
    Record<string, "idle" | "loading" | "queued" | "error">
  >({});
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});
  const [generatedLinks, setGeneratedLinks] = useState<{ jobId: string; label: string }[]>([]);

  // Poll until Drive link is available
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchVideo() {
      try {
        let res = await fetch(`/api/videos?jobId=${videoId}&limit=1`);
        const data = await res.json() as { videos: VideoDetail[] };
        let found: VideoDetail | undefined = data.videos[0];

        if (!found) {
          res = await fetch(`/api/videos/${videoId}`);
          if (res.ok) found = await res.json();
        }

        if (found) {
          setVideo(found as unknown as VideoDetail);
          setLoading(false);
          setActiveContentType(found.contentType);

          const jobStatus = (found as VideoDetail).jobId?.status;
          if (found.driveWebViewLink || jobStatus === "done" || jobStatus === "failed") {
            if (interval) clearInterval(interval);
          }
        } else {
          const jobRes = await fetch(`/api/jobs/${videoId}`);
          if (jobRes.ok) {
            const jobData = await jobRes.json() as { status?: string };
            if (jobData.status === "failed") {
              setError("El job falló durante la generación. Revisá los logs del worker.");
              setLoading(false);
              if (interval) clearInterval(interval);
            }
          } else {
            setError("No se encontró el job ni el video.");
            setLoading(false);
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
    interval = setInterval(fetchVideo, 5000);
    return () => { if (interval) clearInterval(interval); };
  }, [videoId]);

  function versionKey(v: PlatformVersion) {
    return `${v.platform}:${v.contentType}`;
  }

  async function handleGenerate(version: PlatformVersion) {
    if (!video) return;
    const k = versionKey(version);
    setGenStates((s) => ({ ...s, [k]: "loading" }));
    setGenErrors((e) => ({ ...e, [k]: "" }));

    try {
      const res = await fetch(`/api/videos/${video._id}/generate-for`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform:    version.platform,
          contentType: version.contentType,
          videoStyle:  version.videoStyle,
        }),
      });

      const data = await res.json() as { jobId?: string; error?: string; videoId?: string };

      if (res.status === 409) {
        setGenStates((s) => ({ ...s, [k]: "queued" }));
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Error desconocido");

      setGenStates((s) => ({ ...s, [k]: "queued" }));
      setGeneratedLinks((prev) => {
        if (prev.some((l) => l.jobId === data.jobId!)) return prev;
        return [...prev, { jobId: data.jobId!, label: version.label }];
      });
    } catch (err) {
      setGenStates((s) => ({ ...s, [k]: "error" }));
      setGenErrors((e) => ({ ...e, [k]: err instanceof Error ? err.message : String(err) }));
    }
  }

  // The active platform is derived from the selected version's platform
  const activePlatform = video
    ? (ALL_PLATFORM_VERSIONS.find(
        (v) => v.contentType === activeContentType
      )?.platform ?? video.platform)
    : "youtube";

  const contentTypeLabel =
    video?.contentType === "short_video"
      ? "YouTube Short"
      : video?.contentType === "instagram_reel"
      ? "Instagram Reel"
      : "Instagram Post";

  const videoStyleLabel =
    video?.jobId?.videoStyle === "list" ? "Lista / Did you know?" : "Narrativo";

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <a
          href="/select"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          ← Volver a selección
        </a>
        {video && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              video.publishStatus === "published"
                ? "bg-green-500/20 text-green-400"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {video.publishStatus === "published" ? "Publicado" : "Pendiente de publicación"}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-3 py-32 justify-center text-[var(--color-muted)]">
          <span className="animate-spin text-2xl">⟳</span>
          <span className="text-sm">Cargando…</span>
        </div>
      ) : error ? (
        <div className="max-w-xl mx-auto mt-16 px-6">
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            {error}
          </div>
        </div>
      ) : video ? (
        <div className="max-w-6xl mx-auto p-8">

          {/* Title + meta */}
          <h1 className="text-2xl font-bold text-[var(--color-text)] leading-snug mb-2 max-w-3xl">
            {video.title}
          </h1>
          <div className="flex items-center gap-4 mb-8 flex-wrap">
            <MetaChip label="Tipo" value={contentTypeLabel} />
            <span className="text-[var(--color-border)]">·</span>
            <MetaChip label="Estilo" value={videoStyleLabel} />
            <span className="text-[var(--color-border)]">·</span>
            <MetaChip label="Plataforma" value={PLATFORM_CONFIG[video.platform]?.label ?? video.platform} />
            <span className="text-[var(--color-border)]">·</span>
            <MetaChip label="Creado" value={new Date(video.createdAt).toLocaleString()} />
            {video.sourceArticleUrl && (
              <>
                <span className="text-[var(--color-border)]">·</span>
                <a
                  href={video.sourceArticleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  {new URL(video.sourceArticleUrl).hostname} →
                </a>
              </>
            )}
          </div>

          {/* Main layout: left (preview + versions) | right (controls) */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-start">

            {/* ── LEFT: Preview + version selector ── */}
            <div className="flex flex-col items-center gap-6 w-[220px]">

              {/* Preview of the selected version */}
              <PreviewPanel video={video} previewContentType={activeContentType} />

              {/* Version list */}
              <div className="w-full space-y-1.5">
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">
                  Versiones
                </p>
                {ALL_PLATFORM_VERSIONS.map((version) => {
                  const k = versionKey(version);
                  const isCurrent =
                    version.platform === video.platform &&
                    version.contentType === video.contentType;

                  return (
                    <VersionRow
                      key={k}
                      version={version}
                      isActive={activeContentType === version.contentType && (isCurrent || genStates[k] === "queued")}
                      isCurrent={isCurrent}
                      generateState={genStates[k] ?? "idle"}
                      errorMsg={genErrors[k] ?? ""}
                      onSelect={() => setActiveContentType(version.contentType)}
                      onGenerate={() => handleGenerate(version)}
                    />
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT: Controls ── */}
            <div className="space-y-8 max-w-xl">

              {/* Description + hashtags */}
              <section>
                <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-3">
                  Descripción generada
                </h2>
                <DescriptionEditor
                  videoId={video._id}
                  video={video}
                  platform={activePlatform}
                  onSaved={(updates) => setVideo((v) => v ? { ...v, ...updates } : v)}
                />
              </section>

              {/* Drive link */}
              {video.driveWebViewLink && (
                <section>
                  <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">
                    Archivo en Drive
                  </h2>
                  <a
                    href={video.driveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline border border-[var(--color-border)] rounded-lg px-3 py-2 hover:border-[var(--color-accent)] transition-colors"
                  >
                    <span>📁</span>
                    {video.contentType === "instagram_post" ? "Ver tiles en Google Drive" : "Ver en Google Drive"}
                  </a>
                </section>
              )}

              {/* Links to newly generated jobs */}
              {generatedLinks.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-3">
                    Generando versiones
                  </h2>
                  <div className="space-y-2">
                    {generatedLinks.map(({ jobId, label }) => (
                      <a
                        key={jobId}
                        href={`/review/${jobId}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] text-xs text-[var(--color-text)] transition-colors group"
                      >
                        <span>{label}</span>
                        <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                          Ver →
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Publish button */}
              <section>
                <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-3">
                  Publicar
                </h2>
                <PublishSection
                  video={video}
                  platform={activePlatform}
                  onPublished={() =>
                    setVideo((v) => v ? { ...v, publishStatus: "published" } : v)
                  }
                />
              </section>

            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
