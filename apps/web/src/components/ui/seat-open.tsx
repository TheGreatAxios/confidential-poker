import type { SeatPosition } from "@/lib/types";

interface SeatOpenProps {
  position: SeatPosition;
}

const POSITION_CLASSES: Record<SeatPosition, string> = {
  "top-left": "absolute left-[3%] top-[4%] sm:left-[7%] sm:top-[5%]",
  "top-center": "absolute left-1/2 top-[-1%] -translate-x-1/2 -translate-y-5 sm:top-0 sm:-translate-y-8",
  "top-right": "absolute right-[3%] top-[4%] sm:right-[7%] sm:top-[5%]",
  "bottom-right": "absolute bottom-[8%] right-[4%] sm:bottom-[10%] sm:right-[8%]",
  "bottom-center": "absolute bottom-[4%] left-1/2 -translate-x-1/2 translate-y-3 sm:bottom-[5%] sm:translate-y-5",
  "bottom-left": "absolute bottom-[8%] left-[4%] sm:bottom-[10%] sm:left-[8%]",
};

export function SeatOpen({ position }: SeatOpenProps) {
  return (
    <div className={`${POSITION_CLASSES[position]} z-10`}>
      <div className="flex flex-col items-center gap-1.5 opacity-40 transition-opacity duration-300 hover:opacity-70">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-emerald-200/40 sm:h-16 sm:w-16" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">
          Seat Open
        </span>
      </div>
    </div>
  );
}
