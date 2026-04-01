import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { RightSidebar } from "@/components/dashboard/RightSidebar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Short App — Auto-Shorts Pipeline",
  description: "Automated content generation and publishing pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full flex antialiased">
        <Sidebar />
        <main className="flex-1 overflow-auto min-h-full">{children}</main>
        <RightSidebar />
      </body>
    </html>
  );
}
