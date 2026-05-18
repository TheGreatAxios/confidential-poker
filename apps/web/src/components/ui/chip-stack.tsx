import { useId } from "react";
import { formatTokenDisplay } from "@/lib/token-format";

const CHIP_COLORS = [
  { top: "#ef4444", bottom: "#b91c1c", side: "#7f1d1d" },
  { top: "#3b82f6", bottom: "#1d4ed8", side: "#1e3a8a" },
  { top: "#22c55e", bottom: "#15803d", side: "#14532d" },
  { top: "#a855f7", bottom: "#7e22ce", side: "#581c87" },
  { top: "#f59e0b", bottom: "#b45309", side: "#78350f" },
];

interface ChipSVGProps {
  colors: (typeof CHIP_COLORS)[number];
  x: number;
  y: number;
  gradientId: string;
}

function ChipSVG({ colors, x, y, gradientId }: ChipSVGProps) {
  return (
    <svg x={x} y={y} width="28" height="12" viewBox="0 0 28 12" className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.top} />
          <stop offset="100%" stopColor={colors.bottom} />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="24" height="6" rx="3" fill={colors.side} />
      <ellipse cx="14" cy="4" rx="12" ry="4" fill={`url(#${gradientId})`} />
      <line x1="14" y1="1" x2="14" y2="7" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <rect x="10" y="2.5" width="8" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

interface ChipStackProps {
  amount: bigint;
}

export function ChipStack({ amount }: ChipStackProps) {
  const formatted = formatTokenDisplay(amount);
  const baseId = useId();

  const tokenAmount = amount > 0n ? Number(amount / 10n ** 18n) : 0;
  const stackSize = tokenAmount > 0 ? Math.min(5, Math.max(1, Math.ceil(tokenAmount / 50))) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-6 w-8">
        <svg width="32" height="28" viewBox="0 0 32 28" className="overflow-visible">
          {Array.from({ length: stackSize }).map((_, i) => {
            const colorSet = CHIP_COLORS[i % CHIP_COLORS.length];
            const x = 2;
            const y = 16 - i * 3;
            return (
              <ChipSVG
                key={i}
                colors={colorSet}
                x={x}
                y={y}
                gradientId={`${baseId}-chip-${i}`}
              />
            );
          })}
        </svg>
      </div>
      <span className="font-mono text-xs font-semibold text-sky-50">
        {formatted}
      </span>
    </div>
  );
}
