"use client";

import { useState } from "react";

const PRESET_DAYS = [3, 7, 14, 30];

export function DriveCleanupButton() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCleanup() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/drive/cleanup?olderThan=${days}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error ?? "Unknown error"}`);
      } else {
        setResult(data.message);
      }
    } catch {
      setResult("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted)]">Delete Drive folders older than</span>
        <div className="flex gap-1">
          {PRESET_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: days === d ? "var(--color-accent)" : "var(--color-surface)",
                color: days === d ? "#fff" : "var(--color-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        <button
          onClick={handleCleanup}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium text-white cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--color-error)" }}
        >
          {loading ? "Cleaning…" : "Clean Drive"}
        </button>
      </div>
      {result && (
        <p className="text-xs" style={{ color: result.startsWith("Error") ? "var(--color-error)" : "var(--color-success)" }}>
          {result}
        </p>
      )}
    </div>
  );
}
