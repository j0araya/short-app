export default function ConfigPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">Config</h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">
        Pipeline settings. Changes take effect on the next job run.
      </p>
      <p className="text-sm text-[var(--color-muted)]">
        Config form — coming in next iteration. Edit{" "}
        <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-accent)] text-xs">
          project.config.ts
        </code>{" "}
        to change settings now.
      </p>
    </div>
  );
}
