"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplets, DollarSign, Clock, Check, Loader2, X } from "lucide-react";
import clsx from "clsx";

interface FaucetPanelProps {
  msklBalance: number;
  axusdBalance: number;
  msklCooldown: number;
  axusdCooldown: number;
  canClaimMskl: boolean;
  canClaimAxusd: boolean;
  claimingMskl: boolean;
  claimingAxusd: boolean;
  onClaimMskl: () => void;
  onClaimAxusd: () => void;
  onClose?: () => void;
}

function formatBalance(amount: number): string {
  if (amount < 0.01 && amount > 0) return "<$0.01";
  return amount.toFixed(2);
}

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FaucetPanel({
  msklBalance,
  axusdBalance,
  msklCooldown,
  axusdCooldown,
  canClaimMskl,
  canClaimAxusd,
  claimingMskl,
  claimingAxusd,
  onClaimMskl,
  onClaimAxusd,
  onClose,
}: FaucetPanelProps) {
  const [msklFlash, setMsklFlash] = useState(false);
  const [axusdFlash, setAxusdFlash] = useState(false);

  const handleClaimMskl = async () => {
    await onClaimMskl();
    setMsklFlash(true);
    setTimeout(() => setMsklFlash(false), 600);
  };

  const handleClaimAxusd = async () => {
    await onClaimAxusd();
    setAxusdFlash(true);
    setTimeout(() => setAxusdFlash(false), 600);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111111] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h3 className="text-sm font-bold text-white">Faucet</h3>
              <p className="text-[11px] text-white/40 mt-0.5">Claim tokens for playing</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/50" />
              </button>
            )}
          </div>

          {/* Token sections */}
          <div className="p-5 space-y-4">
            {/* mSKL (Gas) */}
            <motion.div
              className={clsx(
                "rounded-xl border p-4 transition-colors duration-500",
                msklFlash ? "border-green-500/40 bg-green-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center">
                    <Droplets className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">mSKL</h4>
                    <p className="text-[10px] text-white/40">Gas token on Europa</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-blue-400">
                    {formatBalance(msklBalance)}
                  </span>
                  <p className="text-[10px] text-white/30">balance</p>
                </div>
              </div>
              <button
                onClick={handleClaimMskl}
                disabled={!canClaimMskl}
                className={clsx(
                  "w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200",
                  canClaimMskl
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
                    : "bg-white/[0.04] text-white/30 cursor-not-allowed"
                )}
              >
                {claimingMskl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Claiming...
                  </>
                ) : msklCooldown > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    Cooldown {formatCooldown(msklCooldown)}
                  </>
                ) : msklFlash ? (
                  <>
                    <Check className="w-4 h-4" />
                    Claimed!
                  </>
                ) : (
                  <>
                    <Droplets className="w-4 h-4" />
                    Claim 100 mSKL
                  </>
                )}
              </button>
            </motion.div>

            {/* axUSD (Betting) */}
            <motion.div
              className={clsx(
                "rounded-xl border p-4 transition-colors duration-500",
                axusdFlash ? "border-green-500/40 bg-green-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-4.5 h-4.5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">axUSD</h4>
                    <p className="text-[10px] text-white/40">Betting token (BITE)</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-green-400">
                    {formatBalance(axusdBalance)}
                  </span>
                  <p className="text-[10px] text-white/30">balance</p>
                </div>
              </div>
              <button
                onClick={handleClaimAxusd}
                disabled={!canClaimAxusd}
                className={clsx(
                  "w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200",
                  canClaimAxusd
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/40"
                    : "bg-white/[0.04] text-white/30 cursor-not-allowed"
                )}
              >
                {claimingAxusd ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Claiming...
                  </>
                ) : axusdCooldown > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    Cooldown {formatCooldown(axusdCooldown)}
                  </>
                ) : axusdFlash ? (
                  <>
                    <Check className="w-4 h-4" />
                    Claimed!
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    Claim 1,000 axUSD
                  </>
                )}
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
