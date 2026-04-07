import { formatTokenAmount } from "@/lib/token-format";

interface ChipStackProps {
  amount: bigint;
  color?: string;
}

export function ChipStack({ amount, color = "#f0b429" }: ChipStackProps) {
  const formatted = formatTokenAmount(amount);

  return (
    <div className="flex items-center gap-1.5">
      {/* Visual chip stack */}
      <div className="relative w-5 h-5">
        <div
          className="absolute w-4 h-4 rounded-full border border-white/20"
          style={{ backgroundColor: color, top: 0, left: 0 }}
        />
        <div
          className="absolute w-4 h-4 rounded-full border border-white/20 opacity-80"
          style={{ backgroundColor: color, top: 2, left: 2 }}
        />
        <div
          className="absolute w-4 h-4 rounded-full border border-white/20 opacity-60"
          style={{ backgroundColor: color, top: 4, left: 1 }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-gray-200">
        {formatted}
      </span>
    </div>
  );
}
