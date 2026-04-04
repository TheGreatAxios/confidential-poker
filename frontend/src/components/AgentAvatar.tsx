"use client";

import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import clsx from "clsx";

interface AgentAvatarProps {
  emoji: string;
  name: string;
  personality: string;
  isActive?: boolean;
  isThinking?: boolean;
  isWinner?: boolean;
  isFolded?: boolean;
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const SIZES = {
  sm: { container: "w-10 h-10", emoji: "text-lg", name: "text-[10px]", badge: "text-[7px] px-1.5 py-0" },
  md: { container: "w-14 h-14", emoji: "text-2xl", name: "text-xs", badge: "text-[8px] px-2 py-0.5" },
  lg: { container: "w-20 h-20", emoji: "text-4xl", name: "text-sm", badge: "text-[9px] px-2.5 py-0.5" },
};

const PERSONALITY_COLORS: Record<string, string> = {
  aggressive: "#EF4444",
  conservative: "#3B82F6",
  deceptive: "#A855F7",
  mathematical: "#22C55E",
  loose: "#F59E0B",
  tight: "#3B82F6",
};

const PERSONALITY_BADGE_BG: Record<string, string> = {
  aggressive: "bg-red-500/20 text-red-400 border-red-500/30",
  conservative: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  deceptive: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  mathematical: "bg-green-500/20 text-green-400 border-green-500/30",
  loose: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  tight: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function getPersonalityKey(personality: string): string {
  return personality.toLowerCase();
}

export default function AgentAvatar({
  emoji,
  name,
  personality,
  isActive = false,
  isThinking = false,
  isWinner = false,
  isFolded = false,
  size = "md",
  color,
  className,
}: AgentAvatarProps) {
  const s = SIZES[size];
  const pKey = getPersonalityKey(personality);
  const pColor = color || PERSONALITY_COLORS[pKey] || "#888";
  const badgeClass = PERSONALITY_BADGE_BG[pKey] || "bg-gray-500/20 text-gray-400 border-gray-500/30";

  return (
    <div className={clsx("flex flex-col items-center gap-1", className)}>
      {/* Avatar circle */}
      <div className="relative">
        <motion.div
          animate={isFolded ? { opacity: 0.35, filter: "grayscale(70%)" } : { opacity: 1, filter: "grayscale(0%)" }}
          transition={{ duration: 0.3 }}
          className={clsx(
            `${s.container} rounded-full flex items-center justify-center border-2 transition-all duration-300 relative`,
            isActive && !isFolded && "ring-2 ring-offset-2 ring-offset-transparent",
            isWinner && "ring-2 ring-poker-gold ring-offset-2 ring-offset-transparent",
          )}
          style={{
            borderColor: isActive && !isFolded ? pColor : `${pColor}50`,
            boxShadow: isActive && !isFolded
              ? `0 0 20px ${pColor}60, 0 0 40px ${pColor}25`
              : isWinner
              ? "0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)"
              : "none",
            backgroundColor: `${pColor}18`,
          }}
        >
          <span className={s.emoji}>{emoji}</span>
        </motion.div>

        {/* Winner crown */}
        {isWinner && (
          <motion.div
            initial={{ y: -10, scale: 0, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <Crown className="w-5 h-5 text-poker-gold drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]" />
          </motion.div>
        )}

        {/* Thinking dots */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5 bg-poker-bg/80 rounded-full px-1.5 py-0.5"
          >
            {[0, 1, 2].map((dot) => (
              <motion.div
                key={dot}
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: pColor }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: dot * 0.2,
                }}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Name */}
      <motion.span
        animate={isFolded ? { opacity: 0.4 } : { opacity: 1 }}
        className={`${s.name} font-semibold text-white leading-tight text-center`}
      >
        {name}
      </motion.span>

      {/* Personality badge */}
      <span className={`${s.badge} rounded-full border font-medium uppercase tracking-wider leading-none`}>
        {personality}
      </span>
    </div>
  );
}
