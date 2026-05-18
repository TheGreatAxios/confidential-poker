
import { AlertTriangle } from "lucide-react";
import skaleLogo from "../../logo.jpg";

interface HeaderProps {
  error: string | null;
}

export function Header({ error }: HeaderProps) {
  return (
    <header className="w-full glass border-b border-white/[0.04] z-50 relative">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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
              Texas Hold&apos;Em on SKALE
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-poker-crimson/8 border border-poker-crimson/15">
              <AlertTriangle size={11} className="text-poker-crimson" />
              <span className="text-[10px] text-poker-crimson/80 font-medium">
                {error}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
