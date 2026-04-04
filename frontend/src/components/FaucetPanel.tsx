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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(165deg, #151515 0%, #111111 50%, #0D0D0D 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div>
              <h3 className="text-sm font-bold text-white/90">Faucet</h3>
              <p className="text-[11px] text-white/35 mt-0.5 tracking-wide">Claim tokens for playing</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>
            )}
          </div>

          {/* Token sections */}
          <div className="p-5 space-y-4">
            {/* mSKL (Gas) */}
            <motion.div
              className={clsx(
                "rounded-xl border p-4 transition-all duration-500",
                msklFlash
                  ? "success-flash"
                  : ""
              )}
              style={{
                background: msklFlash
                  ? "rgba(34, 197, 94, 0.05)"
                  : "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))",
                border: msklFlash
                  ? "1px solid rgba(34, 197, 94, 0.3)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))",
                    border: "1px solid rgba(59, 130, 246, 0.15)",
                  }}>
                    <Droplets className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white/90">mSKL</h4>
                    <p className="text-[10px] text-white/35 tracking-wide">Gas token on Europa</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-blue-400" style={{
                    textShadow: "0 0 8px rgba(59, 130, 246, 0.2)",
                  }}>
                    {formatBalance(msklBalance)}
                  </span>
                  <p className="text-[10px] text-white/25">balance</p>
                </div>
              </div>
              <button
                onClick={handleClaimMskl}
                disabled={!canClaimMskl}
                className={clsx(
                  "w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200",
                  canClaimMskl
                    ? "text-white"
                    : "text-white/25 cursor-not-allowed"
                )}
                style={canClaimMskl ? {
                  background: "linear-gradient(135deg, #2563EB, #3B82F6, #2563EB)",
                  boxShadow: "0 4px 16px rgba(59, 130, 246, 0.25)",
                } : {
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
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
                "rounded-xl border p-4 transition-all duration-500",
                axusdFlash
                  ? "success-flash"
                  : ""
              )}
              style={{
                background: axusdFlash
                  ? "rgba(34, 197, 94, 0.05)"
                  : "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))",
                border: axusdFlash
                  ? "1px solid rgba(34, 197, 94, 0.3)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08))",
                    border: "1px solid rgba(34, 197, 94, 0.15)",
                  }}>
                    <DollarSign className="w-4.5 h-4.5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white/90">axUSD</h4>
                    <p className="text-[10px] text-white/35 tracking-wide">Betting token (BITE)</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-green-400" style={{
                    textShadow: "0 0 8px rgba(34, 197, 94, 0.2)",
                  }}>
                    {formatBalance(axusdBalance)}
                  </span>
                  <p className="text-[10px] text-white/25">balance</p>
                </div>
              </div>
              <button
                onClick={handleClaimAxusd}
                disabled={!canClaimAxusd}
                className={clsx(
                  "w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200",
                  canClaimAxusd
                    ? "text-white"
                    : "text-white/25 cursor-not-allowed"
                )}
                style={canClaimAxusd ? {
                  background: "linear-gradient(135deg, #16A34A, #22C55E, #16A34A)",
                  boxShadow: "0 4px 16px rgba(34, 197, 94, 0.25)",
                } : {
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
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
