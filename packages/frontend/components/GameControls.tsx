"use client";

import { useState } from "react";
import type { GameState } from "@/lib/types";

interface GameControlsProps {
  gameState: GameState;
}

export function GameControls({ gameState }: GameControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState(gameState.minRaise);

  const canCheck = gameState.currentBet === 0;
  const humanBet = gameState.humanPlayer?.currentBet ?? 0;
  const callAmount = gameState.currentBet - humanBet;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        className="px-4 py-2 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-300 text-sm font-semibold hover:bg-gray-600/50 transition-colors"
        onClick={() => alert("Fold!")}
      >
        Fold
      </button>

      {canCheck ? (
        <button
          className="px-4 py-2 rounded-lg bg-poker-blue/20 border border-poker-blue/30 text-poker-blue text-sm font-semibold hover:bg-poker-blue/30 transition-colors"
          onClick={() => alert("Check")}
        >
          Check
        </button>
      ) : (
        <button
          className="px-4 py-2 rounded-lg bg-poker-green/20 border border-poker-green/30 text-poker-green text-sm font-semibold hover:bg-poker-green/30 transition-colors"
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
          className="w-20 px-2 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm text-center font-mono focus:outline-none focus:border-poker-gold/50"
        />
        <button
          className="px-4 py-2 rounded-lg bg-poker-gold/20 border border-poker-gold/30 text-poker-gold text-sm font-semibold hover:bg-poker-gold/30 transition-colors"
          onClick={() => alert(`Raise to ${raiseAmount}`)}
        >
          Raise
        </button>
      </div>

      <button
        className="px-4 py-2 rounded-lg bg-poker-red/20 border border-poker-red/30 text-poker-red text-sm font-bold hover:bg-poker-red/30 transition-colors"
        onClick={() => alert("ALL IN!")}
      >
        ALL IN
      </button>
    </div>
  );
}
