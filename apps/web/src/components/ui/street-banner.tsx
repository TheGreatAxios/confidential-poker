import { useGamePhase } from "@/hooks/useGamePhase";

interface StreetBannerProps {
  communityCardCount: number;
}

export function StreetBanner({ communityCardCount }: StreetBannerProps) {
  const { street } = useGamePhase(communityCardCount);
  return (
    <div className="inline-flex items-center rounded-full border border-emerald-300/25 bg-emerald-900/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.15)] backdrop-blur-sm">
      {street}
    </div>
  );
}
