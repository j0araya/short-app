import type { Video, Job } from "../generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PlatformBadge } from "@/components/ui/PlatformBadge";

type VideoWithJob = Video & { job: Job };

export default async function HistoryPage() {
  const videos = await prisma.video.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: { job: true },
  });

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">History</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">Published videos</p>

      {videos.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No videos published yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video: VideoWithJob) => (
            <div
              key={video.id}
              className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
            >
              {video.job.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.job.thumbnail}
                  alt=""
                  className="w-full aspect-video object-cover"
                />
              )}
              <div className="p-3">
                <p className="text-sm font-medium text-[var(--color-text)] line-clamp-2">
                  {video.title}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <PlatformBadge platform={video.platform} />
                  <span className="text-xs text-[var(--color-muted)]">
                    {video.viewCount.toLocaleString()} views
                  </span>
                </div>
                {video.publishedAt && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {new Date(video.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
