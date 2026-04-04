"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { useGameState } from "@/hooks/useGameState";
import { useFaucet } from "@/hooks/useFaucet";
import { isContractReady, CONTRACTS } from "@/lib/wagmi";
import PokerTable from "@/components/PokerTable";
import GameStats from "@/components/GameStats";
import FaucetPanel from "@/components/FaucetPanel";
import TipButton from "@/components/TipButton";
import GameControls from "@/components/GameControls";
import {
  Shield,
  Wallet,
  Zap,
  Lock,
  BarChart3,
  Droplets,
  Trophy,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { address } = useAccount();
  const { game, loading, isError, refetch } = useGameState();
  const faucet = useFaucet(address ?? "");
  const [showFaucet, setShowFaucet] = useState(false);
  const [gameAction, setGameAction] = useState<string | null>(null);
  const isDemo = !game || !isContractReady(CONTRACTS.pokerTable) || isError;

  const handleStartGame = useCallback(async () => {
    setGameAction("starting");
    try {
      await refetch();
    } finally {
      setGameAction(null);
    }
  }, [refetch]);

  const handleStopGame = useCallback(async () => {
    setGameAction("stopping");
    try {
      await refetch();
    } finally {
      setGameAction(null);
    }
  }, [refetch]);

  return (
    <main className="min-h-screen relative z-10">
      {/* Header — Sticky glass-dark with gold accents */}
      <header className="sticky top-0 z-50 glass-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background: "linear-gradient(135deg, #C9A84C, #D4AF37, #FFD700)",
                boxShadow: "0 0 20px rgba(212, 175, 55, 0.25), 0 0 40px rgba(212, 175, 55, 0.08)",
              }}
            >
              <span className="text-lg">🃏</span>
            </motion.div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-gradient-gold leading-tight tracking-tight">
                AI Poker Night
              </h1>
              <p className="text-[10px] text-gray-500 hidden sm:block tracking-[0.15em] uppercase">
                Texas Hold&apos;em · Encrypted Cards · SKALE
              </p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {isDemo && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-medium tracking-wide" style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))",
                color: "rgba(245, 158, 11, 0.85)",
                border: "1px solid rgba(245, 158, 11, 0.15)",
              }}>
                DEMO
              </span>
            )}
            <button
              onClick={() => setShowFaucet(true)}
              className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))",
                color: "rgba(96, 165, 250, 0.9)",
                border: "1px solid rgba(59, 130, 246, 0.15)",
              }}
            >
              <Droplets className="w-3 h-3" />
              Faucet
            </button>
            <span className="hidden sm:flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium" style={{
              background: "rgba(255,255,255,0.025)",
              color: "rgba(156, 163, 175, 0.8)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <Shield className="w-3 h-3 text-poker-green" style={{
                filter: "drop-shadow(0 0 3px rgba(34, 197, 94, 0.3))",
              }} />
              BITE
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium" style={{
              background: "rgba(255,255,255,0.025)",
              color: "rgba(156, 163, 175, 0.8)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <Wallet className="w-3 h-3 text-poker-gold" style={{
                filter: "drop-shadow(0 0 3px rgba(212, 175, 55, 0.3))",
              }} />
              OWS
            </span>
          </div>
        </div>
        {/* Subtle gold line separator */}
        <div className="header-gold-line" />
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && !game ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              animate={{ scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background: "linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))",
                boxShadow: "0 0 40px rgba(212, 175, 55, 0.1), 0 0 80px rgba(212, 175, 55, 0.04)",
              }}
            >
              <span className="text-3xl">🃏</span>
            </motion.div>
            <div className="text-center">
              <p className="text-sm text-gray-300/80 tracking-wide">Loading table...</p>
              <p className="text-xs text-gray-600 mt-1 tracking-[0.2em] uppercase">Shuffling the deck</p>
            </div>
          </div>
        ) : game ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left: Table area */}
            <div className="space-y-6">
              {/* Poker Table */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <PokerTable game={game} />
              </motion.div>

              {/* Game Controls */}
              <GameControls
                isRunning={game.phase !== "Waiting" && game.phase !== "Finished"}
                phase={game.phase}
                handNumber={Number(game.handNumber)}
                ante={Number(game.smallBlind)}
                busy={gameAction !== null}
                onStart={handleStartGame}
                onNewHand={refetch}
                onStop={handleStopGame}
              />

              {/* Info strip — glass panels */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Lock, label: "Encryption", value: "BITE CTX", color: "#A855F7" },
                  { icon: Zap, label: "Payments", value: "x402", color: "#D4AF37" },
                  { icon: Wallet, label: "Wallets", value: "OWS", color: "#3B82F6" },
                  { icon: BarChart3, label: "Network", value: "SKALE", color: "#22C55E" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="glass-premium flex items-center gap-2 p-2.5 rounded-xl transition-all duration-300 group cursor-default"
                    style={{
                      borderColor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 opacity-60 group-hover:opacity-80 transition-opacity duration-300" style={{ color }} />
                    <div>
                      <span className="text-[10px] text-gray-600 block tracking-[0.15em] uppercase">{label}</span>
                      <span className="text-xs font-semibold text-white/85">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <GameStats game={game} />
              <TipButton />
              <Link
                href="/stats"
                className="block rounded-xl glass-premium p-4 transition-all duration-300 group"
                style={{
                  borderColor: "rgba(255,255,255,0.04)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-poker-gold group-hover:scale-110 transition-transform duration-300" style={{
                      filter: "drop-shadow(0 0 4px rgba(212, 175, 55, 0.3))",
                    }} />
                    <span className="text-sm font-semibold text-white/85 tracking-wide">Agent Leaderboard</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-poker-gold group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer — minimal muted */}
      <footer className="mt-12 relative z-10" style={{
        borderTop: "1px solid rgba(255,255,255,0.03)",
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-gray-600">
            <div className="flex items-center gap-3 tracking-wide">
              <span>Powered by</span>
              <span className="text-gray-400 font-medium">SKALE Network</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-400 font-medium">BITE Protocol</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-400 font-medium">Open Wallet Standard</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-400 font-medium">x402</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">
                OWS Hackathon · Track 4 & 5
              </span>
              <span className="w-1 h-1 rounded-full bg-poker-green animate-pulse" style={{
                boxShadow: "0 0 4px rgba(34, 197, 94, 0.5)",
              }} />
            </div>
          </div>
        </div>
      </footer>

      {/* Faucet Modal */}
      {showFaucet && (
        <FaucetPanel
          msklBalance={faucet.msklBalance}
          axusdBalance={faucet.axusdBalance}
          msklCooldown={faucet.msklCooldown}
          axusdCooldown={faucet.axusdCooldown}
          canClaimMskl={faucet.canClaimMskl}
          canClaimAxusd={faucet.canClaimAxusd}
          claimingMskl={faucet.claimingMskl}
          claimingAxusd={faucet.claimingAxusd}
          onClaimMskl={faucet.claimMskl}
          onClaimAxusd={faucet.claimAxusd}
          onClose={() => setShowFaucet(false)}
        />
      )}
    </main>
  );
}
