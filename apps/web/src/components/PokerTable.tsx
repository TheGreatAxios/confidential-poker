import type { GameState, SeatPosition } from "@/lib/types";
import { SEAT_POSITIONS } from "@/lib/types";
import { AgentSeat } from "./AgentSeat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import { SeatOpen } from "./ui/seat-open";

interface PokerTableProps {
  gameState: GameState;
  compact?: boolean;
}

export function PokerTable({ gameState, compact = false }: PokerTableProps) {
  const occupiedIndices = new Set(gameState.agents.map((a) => a.seatIndex));

  const heightClass = compact
    ? "max-h-[46vh] min-h-[240px]"
    : "max-h-[72vh] min-h-[320px]";

  const centerTranslate = compact
    ? "translate-y-2 sm:translate-y-4"
    : "translate-y-0 sm:translate-y-2";

  return (
    <div className="relative min-h-0 w-full max-w-6xl flex-1">
      <div className={`relative mx-auto w-full min-w-[280px] aspect-[3/2] sm:aspect-[5/2] ${heightClass}`}>
        <div className="wood-rim absolute inset-[4.9%] rounded-[48%] sm:rounded-[40%] border border-black/65" />

        <div
          className="absolute inset-[5.3%] rounded-[48%] sm:rounded-[40%] border-[2px] border-emerald-100/30 bg-[#0d7a43] shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:border-[3px]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 42%, rgba(63, 229, 141, 0.26) 0%, rgba(63, 229, 141, 0.12) 32%, rgba(13, 122, 67, 0) 66%), linear-gradient(180deg, #118a4d 0%, #0d7a43 56%, #0b6537 100%)",
          }}
        />

        <div className="pointer-events-none absolute inset-[5.3%] rounded-[48%] sm:rounded-[40%] shadow-[inset_0_2px_16px_rgba(255,255,255,0.04),inset_0_-10px_18px_rgba(0,0,0,0.22)]" />

        {/* Vignette for extra depth */}
        <div className="pointer-events-none absolute inset-[5.3%] rounded-[48%] sm:rounded-[40%] bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.35)_100%)]" />

        <div className="pointer-events-none absolute inset-[15%] rounded-[48%] sm:rounded-[40%] border border-dashed border-emerald-100/25 shadow-[inset_0_0_18px_rgba(0,0,0,0.26)]" />

        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div className={`flex flex-col items-center gap-3 ${centerTranslate}`}>
            <CommunityCards cards={gameState.communityCards} />
            <PotDisplay pot={gameState.pot} currentBet={gameState.currentBet} sidePots={gameState.sidePots} />
            {gameState.handComplete && gameState.handSummary && (
              <div className="max-w-[340px] rounded-2xl border border-emerald-300/35 bg-emerald-500/12 px-5 py-3 text-center shadow-[0_16px_40px_rgba(16,185,129,0.18)] sm:max-w-[500px]">
                <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-200 uppercase">
                  {gameState.handSummary.endedBy === "showdown" ? "Showdown Result" : "Hand Result"}
                </div>
                <div className="mt-1 text-[12px] font-bold tracking-[0.04em] text-emerald-100 sm:text-sm">
                  {gameState.handSummary.headline}
                </div>
                {gameState.handSummary.detail && (
                  <div className="mt-1 text-[10px] font-medium text-emerald-100/85 sm:text-xs">
                    {gameState.handSummary.detail}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
              compact={compact}
            />
          );
        })}

        {SEAT_POSITIONS.map((position, index) => {
          if (occupiedIndices.has(index)) return null;
          return (
            <SeatOpen
              key={`seat-open-${index}`}
              position={position as SeatPosition}
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
}
