"use client";

import { useEffect, useState } from "react";
import type { GameState } from "@/lib/types";

interface GameControlsProps {
  gameState: GameState;
}

export function GameControls({ gameState }: GameControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState(gameState.minRaise);
  useEffect(() => {
    setRaiseAmount(gameState.minRaise);
  }, [gameState.minRaise]);

  const canCheck = gameState.currentBet === 0;
  const humanBet = gameState.humanPlayer?.currentBet ?? 0;
  const callAmount = Math.max(0, gameState.currentBet - humanBet);

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        className="min-w-[92px] rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-600/50 sm:px-4"
        onClick={() => alert("Fold!")}
      >
        Fold
      </button>

      {canCheck ? (
        <button
          className="min-w-[92px] rounded-lg border border-poker-blue/30 bg-poker-blue/20 px-3 py-2 text-sm font-semibold text-poker-blue transition-colors hover:bg-poker-blue/30 sm:px-4"
          onClick={() => alert("Check")}
        >
          Check
        </button>
      ) : (
        <button
          className="min-w-[92px] rounded-lg border border-poker-green/30 bg-poker-green/20 px-3 py-2 text-sm font-semibold text-poker-green transition-colors hover:bg-poker-green/30 sm:px-4"
          onClick={() => alert(`Call ${callAmount}`)}
        >
          Call {callAmount}
        </button>
      )}

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={raiseAmount}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          min={gameState.minRaise}
          step={gameState.minRaise}
          className="w-16 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-center font-mono text-sm text-white focus:border-poker-gold/50 focus:outline-none sm:w-20"
        />
        <button
          className="min-w-[92px] rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-3 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 sm:px-4"
          onClick={() => alert(`Raise to ${raiseAmount}`)}
        >
          Raise
        </button>
      </div>

      <button
        className="min-w-[92px] rounded-lg border border-poker-red/30 bg-poker-red/20 px-3 py-2 text-sm font-bold text-poker-red transition-colors hover:bg-poker-red/30 sm:px-4"
        onClick={() => alert("ALL IN!")}
      >
        ALL IN
      </button>
    </div>
  );
}
