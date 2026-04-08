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
import { useAccount } from "wagmi";

export default function Home() {
  const { gameState, isConnected, error, joinHumanPlayer } = useGameState();
  const { isConnected: isWalletConnected } = useAccount();

  return (
    <div className="flex min-h-screen flex-col">
      <Header isConnected={isConnected} error={error} />

      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-3 py-4 sm:px-4 sm:py-6">
        {/* Game Phase Indicator */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
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
        </motion.div>

        {/* Poker Table */}
        <PokerTable gameState={gameState} />

        {/* Player Controls */}
        <motion.div
          className="flex w-full max-w-5xl flex-col items-stretch gap-3 sm:items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {gameState.humanPlayer ? (
            <GameControls gameState={gameState} />
          ) : (
            <JoinPanel onJoined={joinHumanPlayer} />
          )}

          {!isConnected && isWalletConnected && <FaucetPanel />}

          {/* Last Action */}
          <AnimatePresence mode="wait">
            {gameState.lastAction && (
              <motion.div
                key={gameState.lastAction}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-center text-xs italic text-poker-text-dim"
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
