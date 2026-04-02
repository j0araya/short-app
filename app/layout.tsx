import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { PromptToStyleProvider } from "@/components/PromptToStyleProvider";
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
      <body className="h-full antialiased">
        <AuthProvider>
          <PromptToStyleProvider enabled={true}>
            {children}
          </PromptToStyleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
