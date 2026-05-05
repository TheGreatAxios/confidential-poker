import { lazy, Suspense, useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PokerTable } from "@/components/PokerTable";
import { GameControls } from "@/components/GameControls";
import { FaucetPanel } from "@/components/FaucetPanel";
import { PlayerHandPanel } from "@/components/PlayerHandPanel";
import { ShowdownSummary } from "@/components/ShowdownSummary";
import { TableLobby } from "@/components/TableLobby";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import type { TableInfo } from "@/lib/types";

const JoinPanel = lazy(() =>
  import("@/components/JoinPanel").then((module) => ({ default: module.JoinPanel })),
);

export default function Home() {
  const [selectedTable, setSelectedTable] = useState<`0x${string}` | null>(null);
  const [selectedTableInfo, setSelectedTableInfo] = useState<TableInfo | null>(null);

  if (!selectedTable) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header error={null} />
        <main className="flex flex-1 justify-center">
          <TableLobby
            onSelectTable={(tableAddress, tableInfo) => {
              setSelectedTable(tableAddress);
              setSelectedTableInfo(tableInfo ?? null);
            }}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return <ActiveTable tableAddress={selectedTable} tableInfo={selectedTableInfo} onBack={() => setSelectedTable(null)} />;
}

function ActiveTable({
  tableAddress,
  tableInfo,
  onBack,
}: {
  tableAddress: `0x${string}`;
  tableInfo: TableInfo | null;
  onBack: () => void;
}) {
  const { gameState, isConnected, error, joinHumanPlayer, leaveHumanPlayer } = useGameState(tableAddress);
  const { isConnected: isWalletConnected } = useAccount();

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <Header error={error} />

      <main className="flex min-h-0 flex-1 flex-col items-center gap-2 px-3 py-3 sm:px-4">
        <div className="flex w-full max-w-6xl shrink-0 items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Back to Lobby
          </button>
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-poker-text-muted sm:block">
            {tableInfo?.name ?? "Selected Table"} · {tableAddress.slice(0, 8)}...{tableAddress.slice(-6)}
          </div>
        </div>

        <PokerTable gameState={gameState} />

        {gameState.humanPlayer && (
          <PlayerHandPanel
            gameState={gameState}
            controls={<GameControls gameState={gameState} onLeft={leaveHumanPlayer} layout="panel" />}
          />
        )}
        <ShowdownSummary gameState={gameState} />

        <motion.div
          className="flex w-full max-w-5xl shrink-0 flex-col items-stretch gap-2 sm:items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {gameState.humanPlayer?.viewerKey === null && (
            <Suspense fallback={null}>
              <JoinPanel
                tableAddress={tableAddress}
                chipTokenAddress={gameState.chipTokenAddress}
                tableInfo={tableInfo}
                mode="rejoin"
                canCashOut={gameState.phase === "waiting"}
                onJoined={joinHumanPlayer}
                onLeft={leaveHumanPlayer}
              />
            </Suspense>
          )}

          {!gameState.humanPlayer && (
            <Suspense fallback={null}>
              <JoinPanel
                tableAddress={tableAddress}
                chipTokenAddress={gameState.chipTokenAddress}
                tableInfo={tableInfo}
                onJoined={joinHumanPlayer}
              />
            </Suspense>
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
                className="text-center text-sm font-semibold text-white"
              >
                {gameState.lastAction}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <Footer compact />
    </div>
  );
}
