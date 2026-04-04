"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGameState } from "@/hooks/useGameState";
import { useFaucet } from "@/hooks/useFaucet";
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
} from "lucide-react";

export default function Home() {
  const { game, loading, isDemo } = useGameState("current");
  const faucet = useFaucet();
  const [showFaucet, setShowFaucet] = useState(false);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-poker-bg/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-poker-gold to-amber-600 flex items-center justify-center shadow-gold"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-lg">🃏</span>
            </motion.div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-gradient-gold leading-tight">
                AI Poker Night
              </h1>
              <p className="text-[10px] text-gray-500 hidden sm:block">
                Texas Hold&apos;em · Encrypted Cards · SKALE Network
              </p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {isDemo && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DEMO MODE
              </span>
            )}
            <button
              onClick={() => setShowFaucet(true)}
              className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <Droplets className="w-3 h-3" />
              Faucet
            </button>
            <span className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
              <Shield className="w-3 h-3 text-poker-green" />
              BITE
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
              <Wallet className="w-3 h-3 text-poker-gold" />
              OWS
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && !game ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-poker-gold/20 to-poker-gold/5 flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="text-3xl">🃏</span>
            </motion.div>
            <div className="text-center">
              <p className="text-sm text-gray-400">Loading table...</p>
              <p className="text-xs text-gray-600 mt-1">Shuffling the deck</p>
            </div>
          </div>
        ) : game ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left: Table area */}
            <div className="space-y-6">
              {/* Poker Table */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <PokerTable game={game} />
              </motion.div>

              {/* Game Controls */}
              <GameControls
                isRunning={game.isRunning}
                phase={game.phase}
                handNumber={game.handNumber}
                ante={game.ante}
                onStart={() => {}}
                onNewHand={() => {}}
                onStop={() => {}}
              />

              {/* Info strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Lock, label: "Encryption", value: "BITE CTX", color: "text-purple-400" },
                  { icon: Zap, label: "Payments", value: "x402", color: "text-poker-gold" },
                  { icon: Wallet, label: "Wallets", value: "OWS", color: "text-blue-400" },
                  { icon: BarChart3, label: "Network", value: "SKALE", color: "text-poker-green" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <div>
                      <span className="text-[10px] text-gray-600 block">{label}</span>
                      <span className="text-xs font-semibold text-white">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <GameStats game={game} />
              <TipButton />
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-gray-600">
            <div className="flex items-center gap-3">
              <span>Powered by</span>
              <span className="text-gray-400 font-medium">SKALE Network</span>
              <span>·</span>
              <span className="text-gray-400 font-medium">BITE Protocol</span>
              <span>·</span>
              <span className="text-gray-400 font-medium">Open Wallet Standard</span>
              <span>·</span>
              <span className="text-gray-400 font-medium">x402</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">
                OWS Hackathon · Track 4 & 5
              </span>
              <span className="w-1 h-1 rounded-full bg-poker-green animate-pulse" />
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
