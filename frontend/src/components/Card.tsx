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
        initial={{ opacity: 0, y: -30, rotate: -5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
        className={clsx(
          "relative inline-flex items-center justify-center rounded-xl overflow-hidden",
          cardSize,
          "bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800",
          "border border-gray-700/50 shadow-card card-shimmer",
          highlighted && "ring-2 ring-poker-gold/50",
          className
        )}
      >
        <Lock className={`${isSmall ? "w-3 h-3" : "w-5 h-5"} text-poker-gold/70 animate-shimmer`} />
        <div className="absolute top-0.5 left-0.5 text-[6px] text-poker-gold/30 font-bold">🔒</div>
        <div className="absolute bottom-0.5 right-0.5 text-[6px] text-poker-gold/30 font-bold">🔒</div>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-poker-gold/5 to-transparent animate-shimmer" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotate: -5, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{
        delay: index * 0.1,
        duration: 0.4,
        ease: [0.175, 0.885, 0.32, 1.275],
      }}
      className={clsx(
        "relative inline-flex flex-col items-center justify-center rounded-xl overflow-hidden",
        cardSize,
        "bg-poker-card shadow-card border border-gray-200/50",
        highlighted && "ring-2 ring-poker-gold shadow-gold",
        className
      )}
    >
      {/* Top-left rank + suit */}
      <div
        className={clsx("absolute top-0.5 left-1 leading-none font-bold", isRed ? "text-red-500" : "text-gray-900", cornerSize)}
      >
        <div>{rankStr}</div>
        <div className="-mt-0.5">{suitStr}</div>
      </div>

      {/* Center suit */}
      <div className={clsx(isRed ? "text-red-500" : "text-gray-900", centerSize, "mt-1")}>
        {suitStr}
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div
        className={clsx("absolute bottom-0.5 right-1 leading-none font-bold rotate-180", isRed ? "text-red-500" : "text-gray-900", cornerSize)}
      >
        <div>{rankStr}</div>
        <div className="-mt-0.5">{suitStr}</div>
      </div>
    </motion.div>
  );
}
