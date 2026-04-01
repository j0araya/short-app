"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ServicesStatus } from "@/components/dashboard/ServicesStatus";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/select", label: "Seleccionar" },
  { href: "/history", label: "Revisión" },
  { href: "/gemini", label: "Gemini" },
  { href: "/logs", label: "Logs" },
  { href: "/config", label: "Config" },
];

// Routes where the sidebar should not render
const SIDEBAR_EXCLUDED = ["/privacy", "/terms"];

export function Sidebar() {
  const pathname = usePathname();

  if (SIDEBAR_EXCLUDED.includes(pathname)) return null;

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-full sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[var(--color-border)] flex-shrink-0">
        <span className="text-sm font-semibold text-[var(--color-text)] tracking-wide uppercase">
          Short App
        </span>
      </div>

      {/* Nav — scrollable if needed, takes remaining space */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block px-3 py-2 rounded text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Services status — always visible, pinned above footer */}
      <ServicesStatus />

      {/* Footer links */}
      <div className="px-6 py-4 border-t border-[var(--color-border)] flex flex-col gap-1 flex-shrink-0">
        <Link
          href="/terms"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Terms of Service
        </Link>
        <Link
          href="/privacy"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Privacy Policy
        </Link>
      </div>
    </aside>
  );
}
