"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";

interface ChipStackProps {
  amount: number;
  animated?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { chipW: 16, chipH: 10, maxChips: 3, text: "text-[10px]", gap: -3 },
  md: { chipW: 24, chipH: 14, maxChips: 4, text: "text-xs", gap: -4 },
  lg: { chipW: 32, chipH: 18, maxChips: 5, text: "text-sm", gap: -5 },
};

export default function ChipStack({
  amount,
  animated = true,
  size = "md",
  className = "",
}: ChipStackProps) {
  const s = SIZES[size];
  const chipCount = Math.min(Math.max(Math.ceil(amount / 500), 1), s.maxChips);

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={amount}
        initial={animated ? { scale: 0.8, opacity: 0.5 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className={`flex flex-col items-center gap-1 ${className}`}
      >
        {/* Visual chip stack */}
        <div className="relative" style={{ width: s.chipW, height: s.chipH * chipCount }}>
          {Array.from({ length: chipCount }).map((_, i) => (
            <motion.div
              key={i}
              initial={animated ? { y: 10, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="absolute left-0 rounded-full"
              style={{
                bottom: i * (s.gap < 0 ? s.chipH + s.gap : s.chipH - s.gap),
                width: s.chipW,
                height: s.chipH,
                background: i % 2 === 0
                  ? "linear-gradient(180deg, #FFD700 0%, #B8960F 100%)"
                  : "linear-gradient(180deg, #FFE44D 0%, #FFD700 100%)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            >
              {/* Chip edge detail */}
              <div
                className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[1px] rounded-full"
                style={{
                  background: amount >= 5000
                    ? "repeating-linear-gradient(90deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 4px)"
                    : "none",
                }}
              />
            </motion.div>
          ))}
          {/* Shine on top chip */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              bottom: (chipCount - 1) * (s.chipH + s.gap),
              width: s.chipW,
              height: s.chipH,
              background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)",
            }}
          />
        </div>

        {/* Amount text */}
        <div className="flex items-center gap-1">
          <Coins className={`${size === "sm" ? "w-3 h-3" : "w-4 h-4"} text-poker-gold`} />
          <span className={`${s.text} font-mono font-bold text-poker-gold pot-glow`}>
            ${amount.toLocaleString()}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
