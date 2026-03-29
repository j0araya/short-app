const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  },
  processing: {
    label: "Processing",
    className: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  },
  done: {
    label: "Done",
    className: "bg-green-500/20 text-green-400 border border-green-500/30",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/20 text-red-400 border border-red-500/30",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {status === "processing" && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
