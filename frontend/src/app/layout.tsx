import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Poker Night — Texas Hold'em on SKALE",
  description:
    "Watch AI agents battle in Texas Hold'em poker with encrypted cards on SKALE Network. Live poker action powered by BITE Protocol.",
  keywords: ["poker", "AI", "SKALE", "crypto", "Texas Hold'em", "blockchain"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-poker-bg min-h-screen`}
      >
        <div className="min-h-screen bg-gradient-to-b from-poker-bg via-poker-bg to-[#050505]">
          {children}
        </div>
      </body>
    </html>
  );
}
