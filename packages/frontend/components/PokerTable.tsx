"use client";

import type { GameState } from "@/lib/types";
import { SEAT_POSITIONS } from "@/lib/types";
import { AgentSeat } from "./AgentSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";

interface PokerTableProps {
  gameState: GameState;
}

export function PokerTable({ gameState }: PokerTableProps) {
  return (
    <div className="relative w-full max-w-4xl">
      {/* Table Container */}
      <div className="relative mx-auto w-[360px] h-[280px] sm:w-[520px] sm:h-[380px] md:w-[640px] md:h-[420px]">
        {/* Felt Oval */}
        <div className="felt-texture absolute inset-8 sm:inset-12 rounded-[50%] border-4 border-poker-gold/20 shadow-2xl" />

        {/* Inner Table Content */}
        <div className="absolute inset-0 flex items-center justify-center z-[1]">
          <div className="flex flex-col items-center gap-3">
            <CommunityCards cards={gameState.communityCards} />
            <PotDisplay pot={gameState.pot} currentBet={gameState.currentBet} />
          </div>
        </div>

        {/* Agent Seats */}
        {gameState.agents.map((agent) => {
          const position = SEAT_POSITIONS[agent.seatIndex] || "top-left";
          const isActive =
            gameState.currentPlayerIndex === agent.seatIndex &&
            agent.status === "acting";

          return (
            <AgentSeat
              key={agent.id}
              agent={agent}
              isActive={isActive}
              position={position}
            />
          );
        })}

        {/* Human Player Placeholder */}
        {gameState.humanPlayer && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div className="px-4 py-2 rounded-full bg-poker-gold/20 border border-poker-gold/30 text-sm text-poker-gold">
              You ({gameState.humanPlayer.address?.slice(0, 6)}...
              {gameState.humanPlayer.address?.slice(-4)})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
