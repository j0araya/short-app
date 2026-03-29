import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Short App — Auto-Shorts Pipeline",
  description: "Automated content generation and publishing pipeline",
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/config", label: "Config" },
  { href: "/history", label: "History" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex antialiased">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
          <div className="px-6 py-5 border-b border-[var(--color-border)]">
            <span className="text-sm font-semibold text-[var(--color-text)] tracking-wide uppercase">
              Short App
            </span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
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
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
