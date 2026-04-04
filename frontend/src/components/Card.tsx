"use client";

import { motion } from "framer-motion";
import { getRankDisplay, getSuitSymbol, getSuitColor } from "@/lib/format";
import { Lock } from "lucide-react";
import clsx from "clsx";

interface CardProps {
  /** Card encoding: (suit << 4) | rank, or use rank/suit directly */
  card?: number;
  /** Card rank (2-14). Ignored if `card` is provided. */
  rank?: number;
  /** Card suit (0-3). Ignored if `card` is provided. */
  suit?: number;
  /** Whether the card is encrypted/face-down */
  encrypted?: boolean;
  /** Legacy prop for face-down state */
  faceDown?: boolean;
  /** Index for stagger animation */
  index?: number;
  /** Legacy size prop — maps to 'sm' or 'md' */
  small?: boolean;
  /** New size prop */
  size?: "sm" | "md" | "lg";
  /** Highlighted state for winning hands */
  highlighted?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export default function Card({
  card,
  rank,
  suit,
  encrypted = false,
  faceDown = false,
  index = 0,
  small = false,
  size,
  highlighted = false,
  className = "",
}: CardProps) {
  // Decode card encoding if provided
  const decodedRank = card !== undefined ? (card & 0x0f) : rank ?? 14;
  const decodedSuit = card !== undefined ? ((card >> 4) & 0x07) : suit ?? 0;
  const rankStr = getRankDisplay(decodedRank);
  const suitStr = getSuitSymbol(decodedSuit);
  const isRed = decodedSuit === 1 || decodedSuit === 2;
  const hidden = encrypted || faceDown || card === undefined;

  // Size mapping
  const isSmall = small || size === "sm";
  const isLarge = size === "lg";

  const cardSize = isSmall
    ? "w-10 h-14 text-xs"
    : isLarge
    ? "w-20 h-28 text-base"
    : "w-14 h-20 sm:w-16 sm:h-22 text-sm";

  const cornerSize = isSmall ? "text-[8px]" : isLarge ? "text-xs" : "text-[10px] sm:text-xs";
  const centerSize = isSmall ? "text-lg" : isLarge ? "text-4xl" : "text-2xl sm:text-3xl";

  if (hidden) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -50, rotate: -8, scale: 0.6 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        transition={{
          delay: index * 0.12,
          duration: 0.45,
          ease: [0.175, 0.885, 0.32, 1.275],
        }}
        className={clsx(
          "relative inline-flex items-center justify-center rounded-xl overflow-hidden",
          cardSize,
          "card-back-pattern",
          "border border-poker-gold/15 shadow-card card-shimmer",
          highlighted && "ring-2 ring-poker-gold/60 shadow-gold",
          className
        )}
        style={{
          boxShadow: highlighted
            ? "0 0 16px rgba(212, 175, 55, 0.3), 0 0 32px rgba(212, 175, 55, 0.1), 0 2px 8px rgba(0,0,0,0.4)"
            : "0 2px 8px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.2)",
        }}
      >
        <Lock className={`${isSmall ? "w-3 h-3" : "w-5 h-5"} text-poker-gold/60`} style={{
          filter: "drop-shadow(0 0 6px rgba(212, 175, 55, 0.4))",
        }} />
        <div className="absolute top-1 left-1 text-[5px] text-poker-gold/25 font-bold">✦</div>
        <div className="absolute bottom-1 right-1 text-[5px] text-poker-gold/25 font-bold">✦</div>
        {/* Gold shimmer sweep */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-poker-gold/[0.06] to-transparent animate-shimmer" />
        {/* Subtle gold edge glow */}
        <div className="absolute inset-0 rounded-xl border border-poker-gold/10 pointer-events-none" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, rotate: -8, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{
        delay: index * 0.12,
        duration: 0.45,
        ease: [0.175, 0.885, 0.32, 1.275],
      }}
      className={clsx(
        "relative inline-flex flex-col items-center justify-center rounded-xl overflow-hidden",
        cardSize,
        "card-face shadow-card-elevated",
        highlighted && "ring-2 ring-poker-gold/70",
        className
      )}
      style={{
        boxShadow: highlighted
          ? "0 0 20px rgba(212, 175, 55, 0.35), 0 0 40px rgba(212, 175, 55, 0.12), 0 8px 32px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.05)",
      }}
    >
      {/* Subtle inner border for card refinement */}
      <div className="absolute inset-[3px] rounded-lg border border-black/[0.04] pointer-events-none" />

      {/* Top-left rank + suit */}
      <div
        className={clsx("absolute top-1 left-1.5 leading-none font-bold", isRed ? "text-red-500" : "text-gray-900", cornerSize)}
      >
        <div>{rankStr}</div>
        <div className="-mt-0.5">{suitStr}</div>
      </div>

      {/* Center suit */}
      <div className={clsx(isRed ? "text-red-500" : "text-gray-900", centerSize, "mt-1")} style={{
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
      }}>
        {suitStr}
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div
        className={clsx("absolute bottom-1 right-1.5 leading-none font-bold rotate-180", isRed ? "text-red-500" : "text-gray-900", cornerSize)}
      >
        <div>{rankStr}</div>
        <div className="-mt-0.5">{suitStr}</div>
      </div>

      {/* Highlighted gold shimmer overlay */}
      {highlighted && (
        <div className="absolute inset-0 bg-gradient-to-tr from-poker-gold/5 via-transparent to-poker-gold/5 rounded-xl pointer-events-none" />
      )}
    </motion.div>
  );
}
