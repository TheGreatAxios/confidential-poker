import { useGameState } from "@/hooks/useGameState";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PokerTable } from "@/components/PokerTable";
import { GameControls } from "@/components/GameControls";
import { FaucetPanel } from "@/components/FaucetPanel";
import { AgentStats } from "@/components/AgentStats";
import { JoinPanel } from "@/components/JoinPanel";
import { PlayerHandPanel } from "@/components/PlayerHandPanel";
import { ShowdownSummary } from "@/components/ShowdownSummary";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";

export default function Home() {
  const { gameState, isConnected, error, joinHumanPlayer, leaveHumanPlayer } = useGameState();
  const { isConnected: isWalletConnected } = useAccount();

  return (
    <div className="flex min-h-screen flex-col">
      <Header isConnected={isConnected} error={error} />

      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-3 py-4 sm:px-4 sm:py-6">
        {/* Poker Table */}
        <PokerTable gameState={gameState} />

        {gameState.humanPlayer && (
          <PlayerHandPanel
            gameState={gameState}
            controls={<GameControls gameState={gameState} onLeft={leaveHumanPlayer} layout="panel" />}
          />
        )}
        <ShowdownSummary gameState={gameState} />

        {/* Player Controls */}
        <motion.div
          className="flex w-full max-w-5xl flex-col items-stretch gap-3 sm:items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {gameState.humanPlayer?.viewerKey === null && (
            <JoinPanel
              mode="rejoin"
              canCashOut={gameState.phase === "waiting"}
              onJoined={joinHumanPlayer}
              onLeft={leaveHumanPlayer}
            />
          )}

          {!gameState.humanPlayer && <JoinPanel onJoined={joinHumanPlayer} />}

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
