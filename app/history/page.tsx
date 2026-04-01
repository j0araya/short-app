import { connectDB, Video, Job } from "@/lib/db";
import { PlatformBadge } from "@/components/ui/PlatformBadge";
import { PendingGrid } from "@/components/history/PendingGrid";
import { Types } from "mongoose";
import type { PublishStatus } from "@/lib/db/models/Video";

// Plain object types returned by .lean() — no Mongoose Document overhead
interface LeanVideo {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  title: string;
  platform: string;
  externalId: string;
  viewCount: number;
  publishedAt: Date | null;
  publishStatus: PublishStatus;
  driveWebViewLink: string | null;
  sourceArticleUrl: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface LeanJob {
  _id: Types.ObjectId;
  title: string;
  sourceUrl: string;
  thumbnail: string | null;
  niche: string;
  platform: string;
  status: string;
  videoPath: string | null;
  errorMsg: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type VideoWithJob = LeanVideo & { job: LeanJob | null };

function toPlain(v: VideoWithJob) {
  return {
    _id: String(v._id),
    title: v.title,
    platform: v.platform,
    driveWebViewLink: v.driveWebViewLink ?? null,
    createdAt: v.createdAt ? v.createdAt.toISOString() : undefined,
    thumbnail: v.job?.thumbnail ?? null,
  };
}

async function fetchVideos(): Promise<VideoWithJob[]> {
  await connectDB();

  const videos = (await Video.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()) as unknown as LeanVideo[];

  const jobIds = videos.map((v) => v.jobId);
  const jobs = (await Job.find({ _id: { $in: jobIds } }).lean()) as unknown as LeanJob[];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  return videos.map((v) => ({
    ...v,
    job: jobMap.get(String(v.jobId)) ?? null,
  }));
}

function VideoCard({ video }: { video: VideoWithJob }) {
  const videoId = String(video._id);
  return (
    <a
      href={`/review/${videoId}`}
      className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden flex flex-col hover:border-[var(--color-accent)]/60 transition-colors cursor-pointer"
    >
      {video.job?.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.job.thumbnail}
          alt=""
          className="w-full aspect-video object-cover"
        />
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-medium text-[var(--color-text)] line-clamp-2">
          {video.title}
        </p>

        <div className="flex items-center justify-between">
          <PlatformBadge platform={video.platform} />
          {video.publishStatus === "published" && (
            <span className="text-xs text-[var(--color-muted)]">
              {video.viewCount.toLocaleString()} views
            </span>
          )}
        </div>

        {video.publishedAt && (
          <p className="text-xs text-[var(--color-muted)]">
            Published {new Date(video.publishedAt).toLocaleDateString()}
          </p>
        )}

        {!video.publishedAt && video.createdAt && (
          <p className="text-xs text-[var(--color-muted)]">
            Created {new Date(video.createdAt).toLocaleDateString()}
          </p>
        )}

        <span className="text-xs text-[var(--color-accent)] mt-auto pt-1">
          Revisar →
        </span>
      </div>
    </a>
  );
}

export default async function HistoryPage() {
  const allVideos = await fetchVideos();

  const pending = allVideos.filter((v) => v.publishStatus === "pending_publish");
  const published = allVideos.filter((v) => v.publishStatus === "published");

  return (
    <div className="p-8 space-y-10">
      {/* Pending publish */}
      <section>
        <h1 className="text-xl font-semibold text-[var(--color-text)] mb-1">
          Ready to Publish
        </h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Videos saved to Drive — review and publish to YouTube.
        </p>

        {pending.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No videos waiting to be published.</p>
        ) : (
          <PendingGrid videos={pending.map(toPlain)} />
        )}
      </section>

      {/* Published */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">Published</h2>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Videos already live on YouTube.
        </p>

        {published.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No published videos yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {published.map((video) => (
              <VideoCard key={String(video._id)} video={video} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
