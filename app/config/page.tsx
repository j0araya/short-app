import { ConfigForm } from "@/components/config/ConfigForm";
import { connectDB, Config } from "@/lib/db";
import { projectConfig } from "@/project.config";
import type { ProjectConfig } from "@/lib/config/schema";

async function getConfig(): Promise<ProjectConfig> {
  await connectDB();
  const stored = await Config.findOne({ id: "singleton" }).lean();
  const overrides = stored ? JSON.parse(stored.data) : {};
  return { ...projectConfig, ...overrides };
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
