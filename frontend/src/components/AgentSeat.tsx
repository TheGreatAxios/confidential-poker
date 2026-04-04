"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Crown, Coins } from "lucide-react";
import Card from "./Card";
import { formatChips } from "@/lib/format";
import { ACTION_COLORS } from "@/lib/constants";
import type { AgentState } from "@/lib/types";
import clsx from "clsx";

interface AgentSeatProps {
  agent: AgentState;
  position: "top" | "bottom" | "left" | "right";
  showCards?: boolean;
}

const GLOW_CLASS: Record<string, string> = {
  "#EF4444": "glow-red",
  "#3B82F6": "glow-blue",
  "#A855F7": "glow-purple",
  "#22C55E": "glow-green",
  "#F59E0B": "glow-amber",
};

export default function AgentSeat({ agent, position, showCards = false }: AgentSeatProps) {
  const isHorizontal = position === "top" || position === "bottom";
  const glowClass = GLOW_CLASS[agent.color] || "glow-gold";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={clsx(
        "relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all duration-300 min-w-[140px]",
        agent.isActive && !agent.folded && `glass-panel ring-1 ring-poker-gold/30 ${glowClass}`,
        agent.isWinner && "glass-panel ring-2 ring-poker-gold/60 winner-glow bg-poker-gold/[0.05]",
        agent.folded && "opacity-30 saturate-0",
        !agent.isActive && !agent.isWinner && !agent.folded && "glass-panel",
      )}
    >
      {/* Winner sparkles */}
      <AnimatePresence>
        {agent.isWinner && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1.4, 0],
                  opacity: [0, 0.9, 0],
                  x: Math.cos((i / 8) * Math.PI * 2) * 45,
                  y: Math.sin((i / 8) * Math.PI * 2) * 35 - 12,
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeOut",
                }}
                className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle, rgba(255, 215, 0, 0.9), rgba(212, 175, 55, 0.4))",
                  filter: "blur(0.4px)",
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Winner crown */}
      <AnimatePresence>
        {agent.isWinner && (
          <motion.div
            initial={{ y: -24, opacity: 0, scale: 0, rotate: -20 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ y: -24, opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 10 }}
            className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 crown-float"
          >
            <div className="relative">
              <Crown className="w-7 h-7 text-poker-gold" style={{
                filter: "drop-shadow(0 0 8px rgba(255,215,0,0.8)) drop-shadow(0 0 16px rgba(255,215,0,0.4))",
              }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dealer / SB / BB position chips */}
      <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 z-20">
        {agent.isDealer && (
          <span className="dealer-chip text-[8px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
            D
          </span>
        )}
        {agent.isSB && (
          <span className="bg-blue-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-md">
            SB
          </span>
        )}
        {agent.isBB && (
          <span className="bg-red-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-md">
            BB
          </span>
        )}
      </div>

      {/* Cards row */}
      <div className={clsx("flex gap-1.5", isHorizontal && "order-first")}>
        {agent.cards.length > 0 ? (
          agent.cards.map((card, i) => {
            const encoded = (card.suit << 4) | card.rank;
            return (
              <Card
                key={i}
                card={showCards || agent.isWinner ? encoded : undefined}
                faceDown={card.encrypted}
                highlighted={agent.isWinner && showCards}
                size="sm"
                index={i}
              />
            );
          })
        ) : (
          <>
            <div className="w-[60px] h-[84px] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015]" style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)",
            }} />
            <div className="w-[60px] h-[84px] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015]" style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)",
            }} />
          </>
        )}
      </div>

      {/* Avatar + Name + Stack */}
      <div className={clsx("flex items-center gap-2.5", isHorizontal && "flex-row-reverse")}>
        {/* Avatar circle */}
        <div className="relative">
          <motion.div
            animate={agent.folded ? { opacity: 0.3, scale: 0.92 } : { opacity: 1, scale: 1 }}
            className={clsx(
              "w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 transition-all duration-300",
              agent.isActive && !agent.folded && "ring-2 ring-offset-1 ring-offset-transparent",
            )}
            style={{
              background: agent.isActive && !agent.folded
                ? `linear-gradient(135deg, ${agent.color}25, ${agent.color}10)`
                : `${agent.color}15`,
              borderColor: agent.isActive && !agent.folded ? agent.color : `${agent.color}35`,
              boxShadow: agent.isActive && !agent.folded
                ? `0 0 16px ${agent.color}50, 0 0 36px ${agent.color}18`
                : agent.isWinner
                ? "0 0 24px rgba(255,215,0,0.5), 0 0 48px rgba(255,215,0,0.2)"
                : "none",
            }}
          >
            {agent.emoji}

            {/* Thinking indicator — animated dots */}
            {agent.isActive && (agent.action === "Wait" || agent.action === "Thinking") && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-[2px] rounded-full px-1.5 py-0.5"
                style={{
                  background: "rgba(8, 8, 8, 0.92)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {[0, 1, 2].map((dot) => (
                  <motion.div
                    key={dot}
                    className="w-[3px] h-[3px] rounded-full bg-poker-gold"
                    animate={{ y: [0, -5, 0], opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.18 }}
                    style={{
                      filter: "drop-shadow(0 0 3px rgba(212, 175, 55, 0.5))",
                    }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Info */}
        <div className={clsx("flex flex-col gap-0.5", isHorizontal && "items-end text-right")}>
          <span className="text-xs font-bold text-white/95 leading-tight">{agent.name}</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] leading-tight" style={{ color: agent.color }}>
            {agent.personality}
          </span>
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-poker-gold/70" />
            <span className="text-xs font-mono font-bold text-poker-gold leading-tight" style={{
              textShadow: "0 0 8px rgba(212, 175, 55, 0.2)",
            }}>
              {formatChips(agent.stack)}
            </span>
          </div>
        </div>
      </div>

      {/* Current bet display — gold-tinted pill */}
      <AnimatePresence>
        {agent.currentBet > 0 && !agent.folded && (
          <motion.div
            initial={{ scale: 0, y: 5, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0, y: 5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(201, 168, 76, 0.06) 100%)",
              border: "1px solid rgba(212, 175, 55, 0.2)",
              boxShadow: "0 2px 8px rgba(212, 175, 55, 0.08)",
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{
              background: "linear-gradient(135deg, #FFD700, #D4AF37)",
              boxShadow: "0 0 6px rgba(255, 215, 0, 0.4)",
            }} />
            <span className="text-[10px] font-mono font-bold text-poker-gold">
              {formatChips(agent.currentBet)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action badge with spring pop */}
      <AnimatePresence mode="popLayout">
        {agent.action && agent.action !== "Wait" && agent.action !== "Thinking" && (
          <motion.span
            key={agent.action}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 18 }}
            className={clsx(
              "text-[10px] font-bold px-2.5 py-0.5 rounded-full border action-badge-enter whitespace-nowrap",
              ACTION_COLORS[agent.action.toLowerCase() as keyof typeof ACTION_COLORS] ||
                (agent.action === "Won!"
                  ? "bg-poker-gold/20 text-poker-gold border-poker-gold/40"
                  : "bg-white/10 text-white border-white/20")
            )}
          >
            {agent.action === "Raise"
              ? `${agent.action} ${formatChips(agent.currentBet)}`
              : agent.action === "All In"
              ? "ALL IN"
              : agent.action}
          </motion.span>
        )}
      </AnimatePresence>

      {/* All-in overlay badge */}
      <AnimatePresence>
        {agent.allIn && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-poker-gold/20 text-poker-gold border border-poker-gold/40 animate-pulse-gold tracking-widest"
          >
            ALL IN
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
