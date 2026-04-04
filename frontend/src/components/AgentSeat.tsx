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
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={clsx(
        "relative flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all duration-300 min-w-[140px]",
        agent.isActive && !agent.folded && `ring-1 ring-poker-gold/40 ${glowClass} bg-white/[0.03]`,
        agent.isWinner && "ring-2 ring-poker-gold glow-gold bg-poker-gold/[0.04]",
        agent.folded && "opacity-35 saturate-0",
        !agent.isActive && !agent.isWinner && !agent.folded && "bg-white/[0.02]",
      )}
    >
      {/* Winner sparkles */}
      <AnimatePresence>
        {agent.isWinner && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1.2, 0],
                  opacity: [0, 1, 0],
                  x: Math.cos((i / 6) * Math.PI * 2) * 40,
                  y: Math.sin((i / 6) * Math.PI * 2) * 30 - 10,
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeOut",
                }}
                className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-poker-gold pointer-events-none"
                style={{ filter: "blur(0.5px)" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Winner crown */}
      <AnimatePresence>
        {agent.isWinner && (
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0, rotate: -15 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
          >
            <div className="relative">
              <Crown className="w-7 h-7 text-poker-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]" />
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
            // Decode card: in the contract, rank is bits 0-3, suit is bits 4-5
            // But in our AgentState, card already has rank & suit
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
          // Empty card slots
          <>
            <div className="w-[60px] h-[84px] rounded-xl border border-dashed border-white/10 bg-white/[0.02]" />
            <div className="w-[60px] h-[84px] rounded-xl border border-dashed border-white/10 bg-white/[0.02]" />
          </>
        )}
      </div>

      {/* Avatar + Name + Stack */}
      <div className={clsx("flex items-center gap-2.5", isHorizontal && "flex-row-reverse")}>
        {/* Avatar circle */}
        <div className="relative">
          <motion.div
            animate={agent.folded ? { opacity: 0.35, scale: 0.95 } : { opacity: 1, scale: 1 }}
            className={clsx(
              "w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 transition-all duration-300",
              agent.isActive && !agent.folded && "ring-2 ring-offset-1 ring-offset-transparent",
            )}
            style={{
              backgroundColor: `${agent.color}18`,
              borderColor: agent.isActive && !agent.folded ? agent.color : `${agent.color}40`,
              boxShadow: agent.isActive && !agent.folded
                ? `0 0 16px ${agent.color}50, 0 0 32px ${agent.color}20`
                : agent.isWinner
                ? "0 0 20px rgba(255,215,0,0.5)"
                : "none",
            }}
          >
            {agent.emoji}

            {/* Thinking indicator */}
            {agent.isActive && (agent.action === "Wait" || agent.action === "Thinking") && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-[2px] bg-poker-bg/90 rounded-full px-1.5 py-0.5"
              >
                {[0, 1, 2].map((dot) => (
                  <motion.div
                    key={dot}
                    className="w-[3px] h-[3px] rounded-full bg-poker-gold"
                    animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.15 }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Info */}
        <div className={clsx("flex flex-col gap-0.5", isHorizontal && "items-end text-right")}>
          <span className="text-xs font-bold text-white leading-tight">{agent.name}</span>
          <span className="text-[9px] font-medium uppercase tracking-wider leading-tight" style={{ color: agent.color }}>
            {agent.personality}
          </span>
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-poker-gold/70" />
            <span className="text-xs font-mono font-bold text-poker-gold leading-tight">
              {formatChips(agent.stack)}
            </span>
          </div>
        </div>
      </div>

      {/* Current bet display */}
      <AnimatePresence>
        {agent.currentBet > 0 && !agent.folded && (
          <motion.div
            initial={{ scale: 0, y: 5, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0, y: 5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-poker-gold/[0.08] border border-poker-gold/20"
          >
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-poker-gold to-poker-goldDark" />
            <span className="text-[10px] font-mono font-bold text-poker-gold">
              {formatChips(agent.currentBet)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action badge */}
      <AnimatePresence mode="popLayout">
        {agent.action && agent.action !== "Wait" && agent.action !== "Thinking" && (
          <motion.span
            key={agent.action}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
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
