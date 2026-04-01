"use client";

/**
 * WorkerStatus — shows a live dot in the sidebar indicating whether
 * the BullMQ worker process is running.
 *
 * Polls /api/health/worker every 15s.
 */

import { useEffect, useState } from "react";

type HealthState = "loading" | "alive" | "dead";

export function WorkerStatus() {
  const [state, setState] = useState<HealthState>("loading");
  const [pendingJobs, setPendingJobs] = useState(0);

  async function check() {
    try {
      const res = await fetch("/api/health/worker", { cache: "no-store" });
      if (!res.ok) { setState("dead"); return; }
      const data = await res.json();
      setState(data.alive ? "alive" : "dead");
      setPendingJobs(data.pendingJobs ?? 0);
    } catch {
      setState("dead");
    }
  }

  useEffect(() => {
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  if (state === "loading") return null;

  const color = state === "alive" ? "var(--color-success)" : "var(--color-error)";
  const label = state === "alive" ? "Worker online" : "Worker offline";

  return (
    <div className="flex items-center gap-2 px-6 py-3">
      {/* Pulsing dot */}
      <span
        className="relative flex h-2 w-2"
        title={label}
      >
        {state === "alive" && (
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
      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
        {state === "alive"
          ? pendingJobs > 0
            ? `${pendingJobs} job${pendingJobs !== 1 ? "s" : ""} queued`
            : "Worker ready"
          : "Worker offline"}
      </span>
    </div>
  );
}
