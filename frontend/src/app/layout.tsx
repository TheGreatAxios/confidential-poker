import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Confidential Poker — Texas Hold'em on SKALE",
  description:
    "Play Texas Hold'em poker with BITE-encrypted cards on SKALE Network. Zero-server, all interactions go directly wallet→contract.",
  keywords: ["poker", "SKALE", "crypto", "Texas Hold'em", "blockchain", "BITE", "confidential"],
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
        <Providers>
          <div className="min-h-screen bg-gradient-to-b from-poker-bg via-poker-bg to-[#050505]">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
