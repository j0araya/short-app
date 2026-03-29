import { ConfigForm } from "@/components/config/ConfigForm";
import type { ProjectConfig } from "@/lib/config/schema";

async function getConfig(): Promise<ProjectConfig> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/config`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export default async function ConfigPage() {
  const config = await getConfig();

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Config</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Pipeline settings. Changes take effect on the next job run.
        </p>
      </div>

      <ConfigForm initial={config} />
    </div>
  );
}
