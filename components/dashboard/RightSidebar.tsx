"use client";

import { usePathname } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

const SIDEBAR_EXCLUDED = ["/privacy", "/terms"];

export function RightSidebar() {
  const pathname = usePathname();

  if (SIDEBAR_EXCLUDED.includes(pathname)) return null;

  return (
    <aside className="w-56 flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-full sticky top-0 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-5 border-b border-[var(--color-border)] flex-shrink-0">
        <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest opacity-60">
          Actividad
        </span>
      </div>

      {/* Feed — takes all remaining space */}
      <div className="flex-1 overflow-y-auto">
        <ActivityFeed embedded />
      </div>
    </aside>
  );
}
