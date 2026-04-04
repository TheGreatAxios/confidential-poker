"use client";

import { motion, AnimatePresence } from "framer-motion";
import Card from "./Card";
import type { CardData, Phase } from "@/lib/types";

interface CommunityCardsProps {
  cards: CardData[];
  phase: Phase;
}

const PHASE_LABELS: Record<Phase, string> = {
  Waiting: "Waiting for Players",
  "Pre-Flop": "Pre-Flop",
  Flop: "Flop",
  Turn: "Turn",
  River: "River",
  Showdown: "Showdown",
};

const PHASE_ICONS: Record<Phase, string> = {
  Waiting: "⏳",
  "Pre-Flop": "🃏",
  Flop: "✨",
  Turn: "🔄",
  River: "🌊",
  Showdown: "🏆",
};

export default function CommunityCards({ cards, phase }: CommunityCardsProps) {
  const totalSlots = 5;
  const visibleCount =
    phase === "Pre-Flop" || phase === "Waiting" ? 0 :
    phase === "Flop" ? 3 :
    phase === "Turn" ? 4 :
    5;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phase label */}
      <motion.div
        key={phase}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2"
      >
        <span className="text-base">{PHASE_ICONS[phase]}</span>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-poker-gold/90">
          {PHASE_LABELS[phase]}
        </span>
      </motion.div>

      {/* Cards row */}
      <div className="flex items-end justify-center gap-2 sm:gap-3">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const isRevealed = i < visibleCount;
          const card = isRevealed ? cards[i] : undefined;

          // Slight visual offset for each slot
          const yOffset = i === 2 ? -4 : i === 1 || i === 3 ? -2 : 0;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: yOffset }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
            >
              {isRevealed && card ? (
                <Card
                  card={(card.suit << 4) | card.rank}
                  faceDown={card.encrypted}
                  highlighted={phase === "Showdown"}
                  size="md"
                  index={i}
                />
              ) : (
                /* Placeholder card */
                <motion.div
                  animate={{
                    opacity: [0.15, 0.25, 0.15],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                  className="w-[80px] h-[112px] rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center"
                >
                  <div className="w-[70px] h-[102px] rounded-lg border border-dashed border-white/[0.08] flex items-center justify-center">
                    <span className="text-white/10 text-lg">?</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Phase progress dots */}
      <div className="flex items-center gap-1.5 mt-1">
        {(["Pre-Flop", "Flop", "Turn", "River", "Showdown"] as Phase[]).map((p, i) => {
          const isActive = PHASE_LABELS[phase] === PHASE_LABELS[p];
          const isPast =
            (p === "Pre-Flop" && ["Flop", "Turn", "River", "Showdown"].includes(phase)) ||
            (p === "Flop" && ["Turn", "River", "Showdown"].includes(phase)) ||
            (p === "Turn" && ["River", "Showdown"].includes(phase)) ||
            (p === "River" && phase === "Showdown");

          return (
            <motion.div
              key={p}
              animate={{
                scale: isActive ? 1.3 : 1,
                backgroundColor: isActive
                  ? "#FFD700"
                  : isPast
                  ? "#22C55E"
                  : "rgba(255,255,255,0.15)",
              }}
              className="w-1.5 h-1.5 rounded-full"
            />
          );
        })}
      </div>
    </div>
  );
}
