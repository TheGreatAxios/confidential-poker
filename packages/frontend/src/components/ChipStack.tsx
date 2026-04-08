import { formatTokenDisplay } from "@/lib/token-format";

interface ChipStackProps {
  amount: bigint;
  color?: string;
}

export function ChipStack({ amount }: ChipStackProps) {
  const formatted = formatTokenDisplay(amount);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-5 h-5">
        <div
          className="absolute h-4 w-4 rounded-full border border-sky-200/80 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,1)_0%,rgba(226,244,255,1)_45%,rgba(145,205,255,1)_100%)] shadow-[0_2px_6px_rgba(42,105,180,0.4)]"
          style={{ top: 0, left: 0 }}
        />
        <div
          className="absolute h-4 w-4 rounded-full border border-sky-200/75 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,1)_0%,rgba(226,244,255,1)_45%,rgba(145,205,255,1)_100%)] opacity-90 shadow-[0_2px_6px_rgba(42,105,180,0.36)]"
          style={{ top: 2, left: 2 }}
        />
        <div
          className="absolute h-4 w-4 rounded-full border border-sky-200/70 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,1)_0%,rgba(226,244,255,1)_45%,rgba(145,205,255,1)_100%)] opacity-80 shadow-[0_2px_6px_rgba(42,105,180,0.32)]"
          style={{ top: 4, left: 1 }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-sky-50">
        {formatted}
      </span>
    </div>
  );
}
