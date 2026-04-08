
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
    <div className="relative w-full max-w-6xl">
      <div className="relative mx-auto aspect-[16/10] w-full max-w-[980px] min-w-[320px]">
        {/* Table Rail */}
        <div className="wood-rim absolute inset-[4.9%] rounded-[48%] border border-black/65" />

        {/* Felt Surface */}
        <div
          className="absolute inset-[5.3%] rounded-[48%] border-[2px] border-emerald-100/30 bg-[#0d7a43] shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:border-[3px]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 42%, rgba(63, 229, 141, 0.26) 0%, rgba(63, 229, 141, 0.12) 32%, rgba(13, 122, 67, 0) 66%), linear-gradient(180deg, #118a4d 0%, #0d7a43 56%, #0b6537 100%)",
          }}
        />

        {/* Felt Depth */}
        <div className="pointer-events-none absolute inset-[5.3%] rounded-[48%] shadow-[inset_0_2px_16px_rgba(255,255,255,0.04),inset_0_-10px_18px_rgba(0,0,0,0.22)]" />

        {/* Inner Betting Ring */}
        <div className="pointer-events-none absolute inset-[15%] rounded-[46%] border border-dashed border-emerald-100/25 shadow-[inset_0_0_18px_rgba(0,0,0,0.26)]" />

        {/* Inner Table Content */}
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div className="flex translate-y-4 flex-col items-center gap-3 sm:translate-y-6">
            <CommunityCards cards={gameState.communityCards} />
            <PotDisplay pot={gameState.pot} currentBet={gameState.currentBet} />
            {gameState.handComplete && gameState.lastAction && (
              <div className="max-w-[320px] rounded-2xl border border-emerald-300/35 bg-emerald-500/12 px-5 py-3 text-center text-[11px] font-bold tracking-[0.08em] text-emerald-100 shadow-[0_16px_40px_rgba(16,185,129,0.18)] sm:max-w-[480px] sm:text-sm">
                {gameState.lastAction}
              </div>
            )}
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

      </div>
    </div>
  );
}
