"use client";

import { useState } from "react";

interface PublishButtonProps {
  videoId: string;
  onPublished?: (externalId: string, url: string) => void;
}

export function PublishButton({ videoId, onPublished }: PublishButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setState("loading");
    setError(null);

    try {
      const res = await fetch(`/api/videos/${videoId}/publish`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setState("done");
      onPublished?.(data.externalId, data.url);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        Published
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handlePublish}
        disabled={state === "loading"}
        className="w-full px-3 py-1.5 rounded text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {state === "loading" ? "Publishing…" : "Publish to YouTube"}
      </button>
      {error && (
        <p className="text-xs text-red-400 line-clamp-2" title={error}>
          {error}
        </p>
      )}
    </div>
  );
}
