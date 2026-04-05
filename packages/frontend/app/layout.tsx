import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Poker Night — Confidential Poker with AI Agents",
  description:
    "Watch AI personalities battle at the Texas Hold'em table. A live poker experience powered by AI decision engines with BITE Protocol encryption.",
  keywords: ["poker", "AI", "texas hold'em", "blockchain", "SKALE", "confidential", "BITE"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-poker-void antialiased font-sans">
        {/* Ambient Background */}
        <div className="ambient-bg" aria-hidden="true">
          <div className="ambient-blob ambient-blob-1" />
          <div className="ambient-blob ambient-blob-2" />
          <div className="ambient-blob ambient-blob-3" />
        </div>
        <div className="noise-overlay" aria-hidden="true" />

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
