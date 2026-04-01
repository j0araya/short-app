"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  configured?: boolean;
}

interface ServicesHealth {
  mongodb: ServiceStatus;
  ollama: ServiceStatus;
  youtube: ServiceStatus;
  tiktok: ServiceStatus;
  instagram: ServiceStatus;
}

interface WorkerHealth {
  alive: boolean;
  pendingJobs: number;
}

interface Profiles {
  youtube: { url: string | null; handle?: string };
  tiktok: { url: string | null; openId?: string };
  instagram: { url: string | null; accountId?: string };
}

type InfraKey = "worker" | "mongodb" | "ollama";
type PlatformKey = "youtube" | "tiktok" | "instagram";

// ── Dot indicator ─────────────────────────────────────────────────────────────

function StatusDot({
  ok,
  pulse = false,
  spinning = false,
}: {
  ok: boolean | null;
  pulse?: boolean;
  spinning?: boolean;
}) {
  if (spinning) {
    return (
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span
          className="animate-spin absolute inline-flex h-full w-full rounded-full border border-transparent"
          style={{
            borderTopColor: "var(--color-muted)",
            borderRightColor: "var(--color-muted)",
          }}
        />
      </span>
    );
  }

  if (ok === null) {
    return (
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span
          className="relative inline-flex rounded-full h-2 w-2 opacity-30"
          style={{ backgroundColor: "var(--color-muted)" }}
        />
      </span>
    );
  }

  const color = ok ? "var(--color-success)" : "var(--color-error)";

  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      {ok && pulse && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// ── Infra row — click revalidates ─────────────────────────────────────────────

function InfraRow({
  label,
  ok,
  sublabel,
  pulse,
  onRevalidate,
}: {
  label: string;
  ok: boolean | null;
  sublabel?: string;
  pulse?: boolean;
  onRevalidate: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [flash, setFlash] = useState<"ok" | "fail" | null>(null);

  async function handleClick() {
    if (checking) return;
    setChecking(true);
    setFlash(null);
    await onRevalidate();
    setChecking(false);
    setFlash(ok ? "ok" : "fail");
    setTimeout(() => setFlash(null), 1500);
  }

  const flashStyle =
    flash === "ok"
      ? { color: "var(--color-success)" }
      : flash === "fail"
      ? { color: "var(--color-error)" }
      : undefined;

  return (
    <button
      onClick={handleClick}
      disabled={checking}
      title={ok ? `${label} — click to revalidate` : `${label} — click to retry connection`}
      className="w-full flex items-center gap-2 min-w-0 rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-white/5 disabled:cursor-wait text-left group"
    >
      <StatusDot ok={checking ? null : ok} pulse={pulse} spinning={checking} />
      <span
        className="text-xs truncate flex-1 transition-colors"
        style={
          flashStyle ?? {
            color:
              ok === null
                ? "var(--color-muted)"
                : ok
                ? "var(--color-muted)"
                : "var(--color-error)",
          }
        }
      >
        {label}
      </span>
      {sublabel && !checking && (
        <span
          className="text-[10px] flex-shrink-0 transition-opacity group-hover:opacity-0"
          style={{ color: "var(--color-muted)", opacity: 0.5 }}
        >
          {sublabel}
        </span>
      )}
      {!checking && (
        <span
          className="text-[10px] flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
          style={{ color: "var(--color-muted)" }}
        >
          ↺
        </span>
      )}
    </button>
  );
}

// ── Platform row — click opens profile ───────────────────────────────────────

function PlatformRow({
  label,
  ok,
  sublabel,
  profileUrl,
  loadingProfile,
}: {
  label: string;
  ok: boolean | null;
  sublabel?: string;
  profileUrl: string | null | undefined;
  loadingProfile: boolean;
}) {
  const isClickable = ok && profileUrl;

  const inner = (
    <>
      <StatusDot ok={ok} />
      <span
        className="text-xs truncate flex-1"
        style={{
          color:
            ok === null
              ? "var(--color-muted)"
              : ok
              ? isClickable
                ? "var(--color-muted)"
                : "var(--color-muted)"
              : "var(--color-error)",
        }}
      >
        {label}
      </span>
      {sublabel && (
        <span
          className="text-[10px] flex-shrink-0"
          style={{ color: "var(--color-muted)", opacity: 0.5 }}
        >
          {sublabel}
        </span>
      )}
      {isClickable && (
        <span
          className="text-[10px] flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
          style={{ color: "var(--color-muted)" }}
        >
          ↗
        </span>
      )}
      {loadingProfile && ok && !profileUrl && (
        <span
          className="text-[10px] flex-shrink-0 animate-pulse"
          style={{ color: "var(--color-muted)", opacity: 0.4 }}
        >
          …
        </span>
      )}
    </>
  );

  if (isClickable) {
    return (
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${label} profile`}
        className="w-full flex items-center gap-2 min-w-0 rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-white/5 group"
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0 px-1 -mx-1 py-0.5">
      {inner}
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

export function ServicesStatus() {
  const [services, setServices] = useState<ServicesHealth | null>(null);
  const [worker, setWorker] = useState<WorkerHealth | null>(null);
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Full refresh (polling)
  const refresh = useCallback(async () => {
    const [svcRes, wrkRes] = await Promise.allSettled([
      fetch("/api/health/services", { cache: "no-store" }),
      fetch("/api/health/worker", { cache: "no-store" }),
    ]);
    if (svcRes.status === "fulfilled" && svcRes.value.ok) {
      setServices(await svcRes.value.json() as ServicesHealth);
    }
    if (wrkRes.status === "fulfilled" && wrkRes.value.ok) {
      setWorker(await wrkRes.value.json() as WorkerHealth);
    }
  }, []);

  // Load profiles once on mount
  useEffect(() => {
    setLoadingProfiles(true);
    fetch("/api/health/profiles", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setProfiles(data as Profiles); })
      .finally(() => setLoadingProfiles(false));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Per-service revalidation handlers
  async function revalidate(key: InfraKey | PlatformKey) {
    const res = await fetch(`/api/health/services?service=${key}`, { cache: "no-store" });
    if (!res.ok) return;
    const patch = await res.json() as Partial<ServicesHealth>;

    if (key === "worker") {
      const wrkRes = await fetch("/api/health/worker", { cache: "no-store" });
      if (wrkRes.ok) setWorker(await wrkRes.json() as WorkerHealth);
      return;
    }

    setServices((prev) =>
      prev ? { ...prev, ...patch } : (patch as ServicesHealth)
    );
  }

  // Derived sublabels
  const workerSublabel =
    worker?.alive && worker.pendingJobs > 0
      ? `${worker.pendingJobs}q`
      : undefined;

  const mongoSublabel = services?.mongodb.ok && services.mongodb.latencyMs !== undefined
    ? `${services.mongodb.latencyMs}ms`
    : undefined;

  const ollamaSublabel = services?.ollama.ok && services.ollama.latencyMs !== undefined
    ? `${services.ollama.latencyMs}ms`
    : undefined;

  return (
    <div
      className="px-4 py-3 border-t space-y-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Infrastructure */}
      <div>
        <SectionLabel>Infra</SectionLabel>
        <div className="space-y-0.5">
          <InfraRow
            label="Worker"
            ok={worker === null ? null : worker.alive}
            sublabel={workerSublabel}
            pulse
            onRevalidate={() => revalidate("worker")}
          />
          <InfraRow
            label="MongoDB"
            ok={services === null ? null : services.mongodb.ok}
            sublabel={mongoSublabel}
            onRevalidate={() => revalidate("mongodb")}
          />
          <InfraRow
            label="Ollama"
            ok={services === null ? null : services.ollama.ok}
            sublabel={ollamaSublabel}
            onRevalidate={() => revalidate("ollama")}
          />
        </div>
      </div>

      {/* Platforms */}
      <div>
        <SectionLabel>Plataformas</SectionLabel>
        <div className="space-y-0.5">
          <PlatformRow
            label="YouTube"
            ok={services === null ? null : services.youtube.ok}
            sublabel={services?.youtube.configured === false ? "no config" : undefined}
            profileUrl={profiles?.youtube.url}
            loadingProfile={loadingProfiles}
          />
          <PlatformRow
            label="TikTok"
            ok={services === null ? null : services.tiktok.ok}
            sublabel={services?.tiktok.configured === false ? "no config" : undefined}
            profileUrl={profiles?.tiktok.url}
            loadingProfile={loadingProfiles}
          />
          <PlatformRow
            label="Instagram"
            ok={services === null ? null : services.instagram.ok}
            sublabel={services?.instagram.configured === false ? "no config" : undefined}
            profileUrl={profiles?.instagram.url}
            loadingProfile={loadingProfiles}
          />
        </div>
      </div>
    </div>
  );
}
