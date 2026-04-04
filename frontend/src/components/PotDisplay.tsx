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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="flex flex-col items-center gap-1"
    >
      <motion.div
        animate={amount > 0 ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex items-center gap-2 px-5 py-2.5 rounded-full bg-poker-gold/[0.07] border border-poker-gold/20 backdrop-blur-sm"
      >
        {/* Glow behind */}
        <div className="absolute inset-0 rounded-full bg-poker-gold/[0.04] blur-lg pointer-events-none" />

        <Coins className="w-5 h-5 text-poker-gold relative z-10" />
        <span className="text-lg sm:text-xl font-mono font-black text-poker-gold pot-glow relative z-10">
          {formatChips(amount)}
        </span>
      </motion.div>

      {/* Player count */}
      {playerCount > 0 && (
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-white/40" />
          <span className="text-[10px] text-white/40 font-medium">
            {playerCount} in pot
          </span>
        </div>
      )}
    </motion.div>
  );
}
