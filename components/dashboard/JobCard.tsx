import { PlatformBadge } from "@/components/ui/PlatformBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Job {
  id: string;
  status: string;
  title: string;
  thumbnail: string | null;
  niche: string;
  platform: string;
  createdAt: string;
  errorMsg: string | null;
}

export function JobCard({ job }: { job: Job }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
      {job.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={job.thumbnail}
          alt=""
          className="w-16 h-16 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded bg-[var(--color-border)] flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)] truncate">{job.title}</p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{job.niche}</p>
        {job.errorMsg && (
          <p className="text-xs text-[var(--color-error)] mt-1 truncate">{job.errorMsg}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <StatusBadge status={job.status} />
        <PlatformBadge platform={job.platform} />
      </div>
    </div>
  );
}
