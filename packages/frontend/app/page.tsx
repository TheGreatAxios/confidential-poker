"use client";

import { useGameState } from "@/hooks/useGameState";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PokerTable } from "@/components/PokerTable";
import { GameControls } from "@/components/GameControls";
import { FaucetPanel } from "@/components/FaucetPanel";
import { AgentStats } from "@/components/AgentStats";
import { JoinPanel } from "@/components/JoinPanel";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { gameState, isConnected, error } = useGameState();

  return (
    <div className="flex min-h-screen flex-col">
      <Header isConnected={isConnected} error={error} />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5">
        {/* Game Phase Indicator */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-[11px] text-poker-text-muted uppercase tracking-[0.15em] font-medium">
            Hand #{gameState.handNumber}
          </span>
          <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-poker-gold/10 text-poker-gold border border-poker-gold/20 shadow-gold-sm">
            {gameState.phase.toUpperCase()}
          </span>
          {!isConnected && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/8 text-amber-400/80 border border-amber-500/15">
              Demo Mode
            </span>
          )}
        </motion.div>

        {/* Poker Table */}
        <PokerTable gameState={gameState} />

        {/* Player Controls */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {gameState.humanPlayer ? (
            <GameControls gameState={gameState} />
          ) : (
            <JoinPanel />
          )}

          {!isConnected && <FaucetPanel />}

          {/* Last Action */}
          <AnimatePresence mode="wait">
            {gameState.lastAction && (
              <motion.div
                key={gameState.lastAction}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-xs text-poker-text-dim italic"
              >
                {gameState.lastAction}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Agent Stats Panel */}
        <AgentStats agents={gameState.agents} />
      </main>

      <Footer />
    </div>
  );
}
