
import { Shield, Wifi, WifiOff, AlertTriangle } from "lucide-react";

interface HeaderProps {
  isConnected: boolean;
  error: string | null;
}

export function Header({ isConnected, error }: HeaderProps) {
  return (
    <header className="w-full glass border-b border-white/[0.04] z-50 relative">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg
              viewBox="0 0 48 48"
              className="h-6 w-6"
              role="img"
              aria-label="SKALE Logo"
            >
              <path d="M24 4L39 12V28L24 36L9 28V12L24 4Z" fill="#00FFC8" />
              <path d="M17 19L24 15L31 19L24 23L17 19Z" fill="#0E1418" />
              <path d="M17 24L24 20L31 24L24 28L17 24Z" fill="#0E1418" />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-bold font-poker text-white leading-tight tracking-tight">
              Texas Hold&apos;Em on SKALE
            </h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Encryption Badge */}
          <div className="shield-badge hidden sm:flex">
            <Shield size={12} className="text-poker-emerald" />
            <span className="text-[10px] font-semibold text-poker-emerald/80">
              BITE Encrypted
            </span>
          </div>

          {error && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-poker-crimson/8 border border-poker-crimson/15">
              <AlertTriangle size={11} className="text-poker-crimson" />
              <span className="text-[10px] text-poker-crimson/80 font-medium">
                {error}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
            {isConnected ? (
              <Wifi size={11} className="text-poker-emerald" />
            ) : (
              <WifiOff size={11} className="text-amber-400" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
