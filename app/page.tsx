import { JobQueue } from "@/components/dashboard/JobQueue";
import { DriveCleanupButton } from "@/components/dashboard/DriveCleanupButton";

async function getPipelineStatus() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/pipeline/status`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const status = await getPipelineStatus();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Pipeline</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Real-time job status
          </p>
        </div>
        <TriggerButton />
      </div>

      {/* Stats */}
      {status && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Queued", value: status.queued, color: "var(--color-warning)" },
            { label: "Processing", value: status.processing, color: "#60a5fa" },
            { label: "Done", value: status.done, color: "var(--color-success)" },
            { label: "Failed", value: status.failed, color: "var(--color-error)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
            >
              <p className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <JobQueue />

      {/* Drive storage management */}
      <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">Drive Storage</p>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              clipshortnews@gmail.com · /shorts/
            </p>
          </div>
          <DriveCleanupButton />
        </div>
      </div>
    </div>
  );
}

function TriggerButton() {
  return (
    <form
      action={async () => {
        "use server";
        await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/pipeline/trigger`,
          { method: "POST" }
        );
      }}
    >
      <button
        type="submit"
        className="px-4 py-2 rounded text-sm font-medium text-white cursor-pointer transition-opacity hover:opacity-80"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        Trigger Pipeline
      </button>
    </form>
  );
}
