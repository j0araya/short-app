"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineLog {
  _id: string;
  jobId: string;
  step: string;
  level: "info" | "warn" | "error";
  message: string;
  durationMs?: number;
  createdAt: string;
}

interface JobSummary {
  id: string;
  title: string;
  status: string;
  platform: string;
  createdAt: string;
  errorMsg: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, string> = {
  info:  "text-[var(--color-text)]",
  warn:  "text-[var(--color-warning)]",
  error: "text-[var(--color-error)]",
};

const LEVEL_PREFIX: Record<string, string> = {
  info:  "INFO ",
  warn:  "WARN ",
  error: "ERR  ",
};

const STEP_COLOR: Record<string, string> = {
  worker:   "#6366f1",
  generate: "#22d3ee",
  upload:   "#a78bfa",
  caption:  "#34d399",
  scrape:   "#f59e0b",
  publish:  "#f472b6",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

const STATUS_STYLE: Record<string, string> = {
  done:       "bg-[#14532d] text-[#4ade80]",
  failed:     "bg-[#450a0a] text-[#f87171]",
  processing: "bg-[#1e1b4b] text-[#818cf8]",
  pending:    "bg-[#1c1917] text-[#a8a29e]",
};

// ── LogLine component ──────────────────────────────────────────────────────────

function LogLine({ log }: { log: PipelineLog }) {
  const stepColor = STEP_COLOR[log.step] ?? "#9ca3af";
  return (
    <div className={`font-mono text-xs leading-5 flex gap-2 ${LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info}`}>
      <span className="text-[var(--color-muted)] flex-shrink-0 select-none w-20">
        {fmtTime(log.createdAt)}
      </span>
      <span
        className="flex-shrink-0 w-16 text-right select-none"
        style={{ color: stepColor }}
      >
        {log.step}
      </span>
      <span className="flex-shrink-0 w-10 select-none opacity-60">
        {LEVEL_PREFIX[log.level]}
      </span>
      <span className="flex-1 break-words whitespace-pre-wrap min-w-0">
        {log.message}
        {log.durationMs != null && (
          <span className="text-[var(--color-muted)] ml-2">({log.durationMs}ms)</span>
        )}
      </span>
    </div>
  );
}

// ── JobLogPanel component ──────────────────────────────────────────────────────

function JobLogPanel({
  job,
  levelFilter,
}: {
  job: JobSummary;
  levelFilter: string[];
}) {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isActive = job.status === "processing" || job.status === "pending";

  const fetchLogs = useCallback(async (since?: string) => {
    const params = new URLSearchParams({ jobId: job.id, limit: "500" });
    if (since) params.set("since", since);
    if (levelFilter.length > 0 && levelFilter.length < 3) {
      params.set("level", levelFilter.join(","));
    }

    const res = await fetch(`/api/logs?${params}`);
    if (!res.ok) return;
    const data = await res.json() as { logs: PipelineLog[] };
    return data.logs;
  }, [job.id, levelFilter]);

  // Initial load — re-runs when job status changes (e.g. after retry)
  useEffect(() => {
    setLoading(true);
    setLogs([]);
    fetchLogs().then((newLogs) => {
      if (newLogs) setLogs(newLogs);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.status, levelFilter.join(",")]);

  // Polling when active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(async () => {
      const last = logs[logs.length - 1];
      const newLogs = await fetchLogs(last?.createdAt);
      if (newLogs && newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs]);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isActive, logs, fetchLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-black/20 rounded-b border-t border-[var(--color-border)]">
      {/* Error banner — shown when the job has a recorded errorMsg */}
      {job.errorMsg && (
        <div className="px-4 py-3 bg-[#450a0a] border-b border-[#7f1d1d] flex items-start gap-2">
          <span className="text-[var(--color-error)] font-mono text-xs font-semibold flex-shrink-0 mt-0.5">
            ERR
          </span>
          <p className="text-[var(--color-error)] font-mono text-xs break-words whitespace-pre-wrap">
            {job.errorMsg}
          </p>
        </div>
      )}

      {loading ? (
        <div className="p-4 space-y-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-[var(--color-border)] animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-6 text-center text-[var(--color-muted)] text-sm font-mono">
          No logs found for this job yet.{isActive ? " Waiting for worker..." : ""}
        </div>
      ) : (
        <div className="p-3 space-y-0.5 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <LogLine key={log._id} log={log} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ── JobRow component ───────────────────────────────────────────────────────────

function JobRow({
  job: initialJob,
  levelFilter,
  onRetried,
}: {
  job: JobSummary;
  levelFilter: string[];
  onRetried: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [job, setJob] = useState(initialJob);
  const [retrying, setRetrying] = useState(false);

  // Sync if parent re-fetches the job list
  useEffect(() => { setJob(initialJob); }, [initialJob]);

  const statusStyle = STATUS_STYLE[job.status] ?? STATUS_STYLE.pending;
  const isActive = job.status === "processing" || job.status === "pending";
  const isFailed = job.status === "failed";

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation(); // don't toggle expand
    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      if (res.ok) {
        // Optimistically update local status so the panel starts polling
        setJob((prev) => ({ ...prev, status: "pending", errorMsg: null }));
        setExpanded(true);
        onRetried(job.id);
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error ?? "Retry failed");
      }
    } catch {
      alert("Network error — could not retry job");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${isFailed ? "border-[#7f1d1d]" : "border-[var(--color-border)]"}`}>
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)]">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          aria-label={expanded ? "Collapse logs" : "Expand logs"}
        >
          <span className={`text-[var(--color-muted)] text-xs transition-transform duration-150 flex-shrink-0 ${expanded ? "rotate-90" : ""}`}>
            ▶
          </span>

          {/* Active pulse */}
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse flex-shrink-0" />
          )}

          {/* Title */}
          <span className="flex-1 text-sm font-medium text-[var(--color-text)] truncate min-w-0">
            {job.title}
          </span>
        </button>

        {/* Meta — right side, never wraps */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[var(--color-muted)] hidden sm:block">
            {fmtDate(job.createdAt)}
          </span>

          <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusStyle}`}>
            {job.status}
          </span>

          {/* Retry button — only for failed jobs */}
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="text-xs px-3 py-1 rounded border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {retrying ? "..." : "Retry"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <JobLogPanel job={job} levelFilter={levelFilter} />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);

  const fetchJobs = useCallback(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data: JobSummary[]) => {
        setJobs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // After a retry the job status changes — refresh the list so the row
  // gets the updated status from the server (not just the optimistic update)
  const handleRetried = useCallback((_id: string) => {
    // Small delay to let the DB write settle before re-fetching
    setTimeout(fetchJobs, 600);
  }, [fetchJobs]);

  const toggleLevel = (level: string) => {
    setLevelFilter((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const LEVELS = [
    { key: "info",  label: "Info",  activeClass: "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-text)]" },
    { key: "warn",  label: "Warn",  activeClass: "bg-[#451a03] text-[var(--color-warning)] border-[var(--color-warning)]" },
    { key: "error", label: "Error", activeClass: "bg-[#450a0a] text-[var(--color-error)] border-[var(--color-error)]" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Pipeline Logs</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Step-by-step execution log for each pipeline job. Retained for 30 days.
          </p>
        </div>

        {/* Level filter */}
        <div className="flex gap-2">
          {LEVELS.map(({ key, label, activeClass }) => {
            const active = levelFilter.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleLevel(key)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  active
                    ? activeClass
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-muted)]"
                }`}
              >
                {label}
              </button>
            );
          })}
          {levelFilter.length > 0 && (
            <button
              onClick={() => setLevelFilter([])}
              className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-muted)] text-sm">
          No jobs found. Run the pipeline to see logs here.
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              levelFilter={levelFilter}
              onRetried={handleRetried}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 flex-wrap pt-2">
        {Object.entries(STEP_COLOR).map(([step, color]) => (
          <div key={step} className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

