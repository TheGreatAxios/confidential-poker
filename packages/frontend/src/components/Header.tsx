
import { Shield, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import skaleLogo from "../../logo.jpg";

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
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <img
              src={skaleLogo}
              alt="SKALE Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-[15px] font-bold font-poker text-white leading-tight tracking-tight">
              Texas Hold&apos;Em on SKALE (Demo)
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
