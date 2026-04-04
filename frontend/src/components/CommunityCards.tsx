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
  Preflop: "Pre-Flop",
  Flop: "Flop",
  Turn: "Turn",
  River: "River",
  Showdown: "Showdown",
  Finished: "Hand Complete",
};

const PHASE_ICONS: Record<Phase, string> = {
  Waiting: "⏳",
  Preflop: "🃏",
  Flop: "✨",
  Turn: "🔄",
  River: "🌊",
  Showdown: "🏆",
  Finished: "✅",
};

export default function CommunityCards({ cards, phase }: CommunityCardsProps) {
  const totalSlots = 5;
  const visibleCount =
    phase === "Preflop" || phase === "Waiting" ? 0 :
    phase === "Flop" ? 3 :
    phase === "Turn" ? 4 :
    5;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phase label with icon + gold text */}
      <motion.div
        key={phase}
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-2"
      >
        <span className="text-base">{PHASE_ICONS[phase]}</span>
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-poker-gold/90" style={{
          textShadow: "0 0 12px rgba(212, 175, 55, 0.2)",
        }}>
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
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: yOffset }}
              transition={{
                delay: isRevealed ? i * 0.1 : 0,
                duration: 0.45,
                ease: "easeOut",
              }}
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
                /* Placeholder card slot with pulsing opacity */
                <motion.div
                  animate={{
                    opacity: [0.1, 0.2, 0.1],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                  className="w-[80px] h-[112px] rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(160deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="w-[70px] h-[102px] rounded-lg border border-dashed border-white/[0.06] flex items-center justify-center">
                    <span className="text-white/[0.08] text-lg">?</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Phase progress dots */}
      <div className="flex items-center gap-2 mt-1">
        {(["Preflop", "Flop", "Turn", "River", "Showdown"] as Phase[]).map((p, i) => {
          const isActive = PHASE_LABELS[phase] === PHASE_LABELS[p];
          const isPast =
            (p === "Preflop" && ["Flop", "Turn", "River", "Showdown"].includes(phase)) ||
            (p === "Flop" && ["Turn", "River", "Showdown"].includes(phase)) ||
            (p === "Turn" && ["River", "Showdown"].includes(phase)) ||
            (p === "River" && phase === "Showdown");

          return (
            <motion.div
              key={p}
              animate={{
                scale: isActive ? 1.4 : 1,
              }}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isActive
                  ? "#FFD700"
                  : isPast
                  ? "#22C55E"
                  : "rgba(255,255,255,0.12)",
                boxShadow: isActive
                  ? "0 0 8px rgba(255, 215, 0, 0.6), 0 0 16px rgba(255, 215, 0, 0.2)"
                  : isPast
                  ? "0 0 4px rgba(34, 197, 94, 0.3)"
                  : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
