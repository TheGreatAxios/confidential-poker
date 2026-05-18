import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Identicon } from "@/components/ui/identicon";
import { WalletConnectButton } from "@/components/wallet-connect-button";
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route path="/tables/:address" element={<TablePage />} />
    </Routes>
  );
}

function LobbyPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <Header error={null} />
      <main className="flex flex-1 justify-center">
        <TableLobby
          onSelectTable={(tableAddress, tableInfo) => {
            navigate(`/tables/${tableAddress}`, { state: { tableInfo } });
          }}
        />
      </main>
      <Footer />
    </div>
  );
}

function TablePage() {
  const { address } = useParams<{ address: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);

  const tableAddress = address as `0x${string}` | undefined;

  useEffect(() => {
    if (location.state?.tableInfo) {
      setTableInfo(location.state.tableInfo);
    }
  }, [location.state]);

  if (!tableAddress || !tableAddress.startsWith("0x")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-poker-text-muted">Invalid table address.</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return <ActiveTable tableAddress={tableAddress} tableInfo={tableInfo} />;
}

function ActiveTable({
  tableAddress,
  tableInfo,
}: {
  tableAddress: `0x${string}`;
  tableInfo: TableInfo | null;
}) {
  const navigate = useNavigate();
  const { gameState, isConnected, error, joinHumanPlayer, leaveHumanPlayer } = useGameState(tableAddress);
  const { isConnected: isWalletConnected } = useAccount();

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <Header error={error} />

      <main className="flex min-h-0 flex-1 flex-col items-center gap-2 px-3 py-3 pb-8 sm:px-4">
        <div className="flex w-full max-w-6xl shrink-0 items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Back to Lobby
          </button>
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:flex">
            <Identicon address={tableAddress} size={16} />
            <span className="font-mono text-xs text-poker-text-muted">
              {tableInfo?.name ?? "Selected Table"} · {tableAddress.slice(0, 8)}...{tableAddress.slice(-6)}
            </span>
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              SKALE
            </span>
          </div>
        </div>

        <PokerTable gameState={gameState} compact={!!gameState.humanPlayer} />

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

          {!gameState.humanPlayer && isWalletConnected && (
            <Suspense fallback={null}>
              <JoinPanel
                tableAddress={tableAddress}
                chipTokenAddress={gameState.chipTokenAddress}
                tableInfo={tableInfo}
                onJoined={joinHumanPlayer}
              />
            </Suspense>
          )}

          {!gameState.humanPlayer && !isWalletConnected && (
            <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-poker-text-muted">
                  Spectating
                </span>
                <span className="text-xs text-poker-text-dim">
                  Connect wallet to join the table
                </span>
              </div>
              <WalletConnectButton />
            </div>
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
