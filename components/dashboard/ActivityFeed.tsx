"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ActivityEventType } from "@/lib/db/models/ActivityEvent";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  _id: string;
  type: ActivityEventType;
  title: string;
  platform?: string;
  url?: string;
  errorMsg?: string;
  jobId?: string;
  videoId?: string;
  createdAt: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;
const MAX_DISPLAY = 20;

// ── Event type metadata ───────────────────────────────────────────────────────

const EVENT_META: Record<
  ActivityEventType,
  { label: string; dotColor: string; pulse?: boolean }
> = {
  video_generating: {
    label: "Generating",
    dotColor: "var(--color-warning)",
    pulse: true,
  },
  video_ready: {
    label: "Ready",
    dotColor: "var(--color-success)",
  },
  video_published: {
    label: "Published",
    dotColor: "var(--color-accent)",
  },
  job_failed: {
    label: "Failed",
    dotColor: "var(--color-error)",
  },
};

const PLATFORM_LABEL: Record<string, string> = {
  youtube:   "YouTube",
  tiktok:    "TikTok",
  instagram: "Instagram",
  gemini:    "Gemini",
};

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── Single event row ──────────────────────────────────────────────────────────

function EventRow({
  event,
  fresh,
}: {
  event: ActivityEvent;
  fresh: boolean;
}) {
  const meta = EVENT_META[event.type];

  // Fast link logic:
  //   video_published  → external platform URL (event.url)
  //   video_ready      → internal review page (/review/[videoId ?? jobId])
  //   video_generating → internal review page if jobId available
  const reviewId = event.videoId ?? event.jobId;
  const internalLink = reviewId ? `/review/${reviewId}` : null;

  const fastLink =
    event.type === "video_published" && event.url
      ? { href: event.url, external: true, label: PLATFORM_LABEL[event.platform ?? ""] ?? event.platform ?? "Ver" }
      : (event.type === "video_ready" || event.type === "video_generating") && internalLink
      ? { href: internalLink, external: false, label: "Ver" }
      : null;

  return (
    <div
      className="flex flex-col gap-1.5 px-1 py-2 rounded transition-colors"
      style={fresh ? { backgroundColor: "rgba(255,255,255,0.03)" } : undefined}
    >
      {/* Row 1: dot + title */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0 mt-[5px]">
          {meta.pulse && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ backgroundColor: meta.dotColor }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: meta.dotColor }}
          />
        </span>
        <p
          className="text-[11px] leading-tight"
          style={{ color: "var(--color-text)", opacity: 0.8 }}
          title={event.title}
        >
          {event.title}
        </p>
      </div>

      {/* Row 2: meta chips + fast link */}
      <div className="flex items-center justify-between gap-2 pl-3.5">
        <p
          className="text-[10px] flex items-center gap-1 flex-wrap"
          style={{ color: "var(--color-muted)", opacity: 0.5 }}
        >
          <span>{meta.label}</span>
          {event.platform && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span className="capitalize">{PLATFORM_LABEL[event.platform] ?? event.platform}</span>
            </>
          )}
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{relativeTime(event.createdAt)}</span>
        </p>

        {fastLink && (
          <a
            href={fastLink.href}
            target={fastLink.external ? "_blank" : "_self"}
            rel={fastLink.external ? "noopener noreferrer" : undefined}
            className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors"
            style={{
              borderColor: meta.dotColor + "50",
              color: meta.dotColor,
              backgroundColor: meta.dotColor + "12",
            }}
          >
            {fastLink.label}{fastLink.external ? " ↗" : " →"}
          </a>
        )}
      </div>

      {/* Error message for failed jobs */}
      {event.type === "job_failed" && event.errorMsg && (
        <p
          className="pl-3.5 text-[10px] leading-snug line-clamp-2"
          style={{ color: "var(--color-error)", opacity: 0.7 }}
          title={event.errorMsg}
        >
          {event.errorMsg}
        </p>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
      style={{ color: "var(--color-muted)", opacity: 0.4 }}
    >
      {children}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivityFeed({ embedded = false }: { embedded?: boolean }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const latestCreatedAt = useRef<string | null>(null);
  const initialized = useRef(false);

  const fetchEvents = useCallback(async (after?: string) => {
    try {
      const url = after
        ? `/api/activity?limit=${MAX_DISPLAY}&after=${encodeURIComponent(after)}`
        : `/api/activity?limit=${MAX_DISPLAY}`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const { events: incoming } = (await res.json()) as { events: ActivityEvent[] };

      if (incoming.length === 0) return;

      if (!initialized.current) {
        setEvents(incoming);
        if (incoming[0]) latestCreatedAt.current = incoming[0].createdAt;
        initialized.current = true;
        return;
      }

      const newIds = new Set(incoming.map((e) => e._id));
      setFreshIds(newIds);
      setTimeout(() => setFreshIds(new Set()), 3000);

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e._id));
        const truly_new = incoming.filter((e) => !existingIds.has(e._id));
        if (truly_new.length === 0) return prev;
        return [...truly_new, ...prev].slice(0, MAX_DISPLAY);
      });

      if (incoming[0]) latestCreatedAt.current = incoming[0].createdAt;
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchEvents(latestCreatedAt.current ?? undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchEvents]);

  if (events.length === 0) return null;

  const list = (
    <div className="divide-y divide-[var(--color-border)]/40">
      {events.map((event) => (
        <EventRow
          key={event._id}
          event={event}
          fresh={freshIds.has(event._id)}
        />
      ))}
    </div>
  );

  if (embedded) {
    return <div className="px-3 py-2">{list}</div>;
  }

  return (
    <div className="px-4 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
      <SectionLabel>Actividad</SectionLabel>
      {list}
    </div>
  );
}
