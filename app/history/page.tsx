import { connectDB, Video, Job } from "@/lib/db";
import { PlatformBadge } from "@/components/ui/PlatformBadge";
import { Types } from "mongoose";

// Plain object types returned by .lean() — no Mongoose Document overhead
interface LeanVideo {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  title: string;
  platform: string;
  externalId: string;
  viewCount: number;
  publishedAt: Date;
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

export default async function HistoryPage() {
  await connectDB();

  const videos = (await Video.find()
    .sort({ publishedAt: -1 })
    .limit(50)
    .lean()) as unknown as LeanVideo[];

  const jobIds = videos.map((v) => v.jobId);
  const jobs = (await Job.find({ _id: { $in: jobIds } }).lean()) as unknown as LeanJob[];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  const videosWithJobs: VideoWithJob[] = videos.map((v) => ({
    ...v,
    job: jobMap.get(String(v.jobId)) ?? null,
  }));

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">History</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">Published videos</p>

      {videosWithJobs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No videos published yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videosWithJobs.map((video) => (
            <div
              key={String(video._id)}
              className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
            >
              {video.job?.thumbnail && (
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
