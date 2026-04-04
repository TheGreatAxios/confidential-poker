"use client";

import { motion } from "framer-motion";
import AgentSeat from "./AgentSeat";
import CommunityCards from "./CommunityCards";
import PotDisplay from "./PotDisplay";
import type { GameState, AgentState, CardData, Phase } from "@/lib/types";

interface PokerTableProps {
  game: GameState;
  showCards?: boolean;
}

/** Map contract PlayerState → AgentState for AgentSeat component */
function playerToAgent(
  player: GameState["players"][number],
  index: number
): AgentState {
  const COLORS = ["#EF4444", "#3B82F6", "#A855F7", "#22C55E"];
  const EMOJIS = ["🤬", "🧐", "🎭", "🧮"];
  const NAMES = ["Rage Bot", "Caution", "Bluffer", "Calculus"];
  const PERSONALITIES = ["Aggressive", "Conservative", "Deceptive", "Mathematical"];

  // Decode hole cards
  const cards: CardData[] = player.holeCards.map((encoded) => ({
    rank: encoded & 0x0f,
    suit: (encoded >> 4) & 0x03,
    encrypted: false,
  }));

  return {
    id: index,
    name: NAMES[index] ?? `Player ${index + 1}`,
    emoji: EMOJIS[index] ?? "🃏",
    color: COLORS[index] ?? "#888",
    personality: PERSONALITIES[index] ?? "Unknown",
    stack: Number(player.stack),
    currentBet: Number(player.currentBet),
    cards,
    action: player.folded ? "Folded" : player.isActive ? "Thinking" : "Wait",
    folded: player.folded,
    allIn: false,
    isDealer: player.isDealer,
    isSB: false,
    isBB: false,
    isActive: player.isActive,
    isWinner: player.isWinner,
  };
}

/** Map encoded community card numbers → CardData */
function decodeCommunityCards(cards: number[]): CardData[] {
  return cards.map((encoded) => ({
    rank: encoded & 0x0f,
    suit: (encoded >> 4) & 0x03,
    encrypted: false,
  }));
}

export default function PokerTable({ game, showCards = false }: PokerTableProps) {
  const agents = game.players
    .filter((p) => p.isSeated)
    .map((p, i) => playerToAgent(p, i));

  const communityCards = decodeCommunityCards(game.communityCards);
  const phase = game.phase;
  const pot = Number(game.pot);
  const handNumber = Number(game.handNumber);
  const isRunning = phase !== "Waiting" && phase !== "Finished";

  const activePlayers = agents.filter((a) => !a.folded).length;

  // Status text
  const statusText = !isRunning
    ? "Waiting to Start"
    : phase === "Showdown"
    ? `Hand #${handNumber} Complete`
    : `Hand #${handNumber} — ${phase}`;

  const positions: Array<"top" | "left" | "right" | "bottom"> = ["top", "left", "right", "bottom"];

  return (
    <div className="table-perspective w-full max-w-[900px] mx-auto">
      {/* Status Banner */}
      <motion.div
        key={statusText}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-4"
      >
        <h2 className="text-sm sm:text-base font-semibold text-white/80 tracking-wide">
          {statusText}
        </h2>
        {isRunning && phase !== "Showdown" && (
          <div className="w-32 h-[2px] mx-auto mt-2 rounded-full phase-glow-line" />
        )}
      </motion.div>

      {/* Table Container */}
      <motion.div
        className="table-3d relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Outer wood rail */}
        <div className="wood-rail rounded-[50%] p-3 sm:p-4">
          {/* Inner felt surface */}
          <div className="felt-surface rounded-[50%] p-6 sm:p-10 min-h-[340px] sm:min-h-[420px] relative overflow-hidden">
            {/* Ambient light effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-radial pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, rgba(15,95,15,0.15) 0%, transparent 70%)",
              }}
            />

            {/* Inner oval line decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[70%] rounded-[50%] border border-white/[0.04] pointer-events-none" />

            {/* Seats Grid */}
            <div className="relative w-full h-full min-h-[260px] sm:min-h-[320px]">
              {/* TOP seat */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                {agents[0] && (
                  <AgentSeat agent={agents[0]} position="top" showCards={showCards} />
                )}
              </div>

              {/* LEFT seat */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-2">
                {agents[1] && (
                  <AgentSeat agent={agents[1]} position="left" showCards={showCards} />
                )}
              </div>

              {/* RIGHT seat */}
              <div className="absolute top-1/2 right=0 -translate-y-1/2 translate-x-2">
                {agents[2] && (
                  <AgentSeat agent={agents[2]} position="right" showCards={showCards} />
                )}
              </div>

              {/* BOTTOM seat */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2">
                {agents[3] && (
                  <AgentSeat agent={agents[3]} position="bottom" showCards={showCards} />
                )}
              </div>

              {/* Center area: Community Cards + Pot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-10">
                {/* Pot */}
                <PotDisplay amount={pot} playerCount={activePlayers} />

                {/* Community Cards */}
                <CommunityCards cards={communityCards} phase={phase} />
              </div>

              {/* Floating ambient particles */}
              {isRunning && [...Array(4)].map((_, i) => (
                <motion.div
                  key={`particle-${i}`}
                  className="absolute w-1 h-1 rounded-full bg-poker-gold/20 pointer-events-none"
                  style={{
                    left: `${30 + i * 15}%`,
                    top: `${40 + (i % 2) * 20}%`,
                  }}
                  animate={{
                    y: [0, -15 - i * 5, 0],
                    x: [0, 5 + i * 3, 0],
                    opacity: [0, 0.6, 0],
                  }}
                  transition={{
                    duration: 3 + i,
                    repeat: Infinity,
                    delay: i * 0.8,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Table shadow */}
      <div className="mx-auto w-[90%] h-6 bg-black/30 blur-xl rounded-full -mt-1" />
    </div>
  );
}
