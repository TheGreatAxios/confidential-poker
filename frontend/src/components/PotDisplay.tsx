"use client";

import { motion } from "framer-motion";
import { Coins, Users } from "lucide-react";
import { formatChips } from "@/lib/format";

interface PotDisplayProps {
  amount: number;
  playerCount: number;
}

export default function PotDisplay({ amount, playerCount }: PotDisplayProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      className="flex flex-col items-center gap-1.5"
    >
      <motion.div
        animate={amount > 0 ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex items-center gap-2.5 px-6 py-3 rounded-full pot-ring-pulse"
        style={{
          background: "linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(201, 168, 76, 0.06) 50%, rgba(212, 175, 55, 0.1) 100%)",
          border: "1px solid rgba(212, 175, 55, 0.25)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Glow behind */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, rgba(212, 175, 55, 0.08) 0%, transparent 70%)",
          filter: "blur(12px)",
        }} />

        <Coins className="w-5 h-5 text-poker-gold relative z-10" style={{
          filter: "drop-shadow(0 0 6px rgba(255, 215, 0, 0.4))",
        }} />
        <span className="text-lg sm:text-xl font-mono font-black text-poker-gold pot-glow relative z-10">
          {formatChips(amount)}
        </span>
      </motion.div>

      {/* Player count subtitle */}
      {playerCount > 0 && (
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-white/30" />
          <span className="text-[10px] text-white/30 font-medium tracking-wide">
            {playerCount} in pot
          </span>
        </div>
      )}
    </motion.div>
  );
}
