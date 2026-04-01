"use client";

import { PlatformBadge } from "@/components/ui/PlatformBadge";

interface PendingVideo {
  _id: string;
  title: string;
  platform: string;
  driveWebViewLink: string | null;
  createdAt?: string;
  thumbnail?: string | null;
}

export function PendingGrid({ videos }: { videos: PendingVideo[] }) {
  if (videos.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        No videos waiting to be published.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <a
          key={video._id}
          href={`/review/${video._id}`}
          className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden flex flex-col hover:border-[var(--color-accent)]/60 transition-colors cursor-pointer group"
        >
          {video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              className="w-full aspect-video object-cover"
            />
          ) : (
            <div className="w-full aspect-video bg-[var(--color-border)] flex items-center justify-center">
              <span className="text-3xl opacity-20">🎬</span>
            </div>
          )}

          <div className="p-3 flex flex-col gap-2 flex-1">
            <p className="text-sm font-medium text-[var(--color-text)] line-clamp-2">
              {video.title}
            </p>

            <div className="flex items-center justify-between">
              <PlatformBadge platform={video.platform} />
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                Pendiente
              </span>
            </div>

            {video.createdAt && (
              <p className="text-xs text-[var(--color-muted)]">
                {new Date(video.createdAt).toLocaleDateString()}
              </p>
            )}

            <span className="text-xs text-[var(--color-accent)] mt-auto pt-1 group-hover:underline">
              Revisar y publicar →
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
