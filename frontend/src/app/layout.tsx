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
          <div className="min-h-screen relative">
            {/* Layered dark background with luxurious depth — gold & emerald glows */}
            <div className="fixed inset-0 pointer-events-none" style={{
              background: `
                radial-gradient(ellipse 600px 300px at 50% -2%, rgba(212, 175, 55, 0.025) 0%, transparent 100%),
                radial-gradient(ellipse 500px 500px at 15% 20%, rgba(13, 61, 35, 0.18) 0%, transparent 70%),
                radial-gradient(ellipse 500px 500px at 85% 25%, rgba(13, 61, 35, 0.12) 0%, transparent 70%),
                radial-gradient(ellipse 400px 400px at 50% 60%, rgba(10, 47, 26, 0.08) 0%, transparent 60%),
                radial-gradient(ellipse 300px 200px at 80% 85%, rgba(212, 175, 55, 0.012) 0%, transparent 100%),
                linear-gradient(180deg, #080808 0%, #0A0A0A 30%, #080808 60%, #050505 100%)
              `
            }} />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
