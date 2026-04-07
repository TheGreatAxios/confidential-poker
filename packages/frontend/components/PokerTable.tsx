"use client";

import type { GameState, SeatPosition } from "@/lib/types";
import { SEAT_POSITIONS } from "@/lib/types";
import { AgentSeat } from "./AgentSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";

interface PokerTableProps {
  gameState: GameState;
}

export function PokerTable({ gameState }: PokerTableProps) {
  return (
    <div className="relative w-full max-w-5xl">
      {/* Table Container */}
      <div className="relative mx-auto aspect-[16/10] w-full max-w-[860px] min-w-[300px]">
        {/* Felt Oval */}
        <div className="felt-texture absolute inset-[8%] rounded-[50%] border-[3px] border-poker-gold/20 shadow-2xl sm:border-4" />

        {/* Inner Table Content */}
        <div className="absolute inset-0 flex items-center justify-center z-[1]">
          <div className="flex flex-col items-center gap-3">
            <CommunityCards cards={gameState.communityCards} />
            <PotDisplay pot={gameState.pot} currentBet={gameState.currentBet} />
          </div>
        </div>

        {/* Agent Seats */}
        {gameState.agents.map((agent) => {
          const position = (SEAT_POSITIONS[agent.seatIndex] ?? "top-left") as SeatPosition;
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
          <div className="absolute bottom-[6%] left-1/2 z-20 -translate-x-1/2">
            <div className="rounded-full border border-poker-gold/30 bg-poker-gold/20 px-3 py-1.5 text-xs text-poker-gold sm:px-4 sm:py-2 sm:text-sm">
              You ({gameState.humanPlayer.address?.slice(0, 6)}...
              {gameState.humanPlayer.address?.slice(-4)})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
