"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronDown, CheckCircle } from "lucide-react";
import { useTips, TipRecord } from "@/hooks/useTips";
import { AGENTS } from "@/lib/constants";
import clsx from "clsx";

export default function TipButton() {
  const { tips, tipping, sendTip } = useTips();
  const [isOpen, setIsOpen] = useState(false);
  const [justTipped, setJustTipped] = useState<string | null>(null);

  const handleTip = async (agentId: number) => {
    await sendTip(agentId, 0.05);
    setJustTipped(agentId.toString());
    setTimeout(() => setJustTipped(null), 2000);
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="rounded-xl glass-panel overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.015] transition-colors duration-200"
      >
        <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400" style={{
            filter: "drop-shadow(0 0 4px rgba(244, 114, 182, 0.3))",
          }} />
          Tip an Agent
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{
            background: "linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.08))",
            color: "#D4AF37",
            border: "1px solid rgba(212, 175, 55, 0.2)",
          }}>
            x402 · $0.05
          </span>
        </h3>
        <ChevronDown
          className={clsx(
            "w-4 h-4 text-gray-500 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Agent tip buttons — grid with color-tinted avatars */}
              <div className="grid grid-cols-2 gap-2">
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleTip(agent.id)}
                    disabled={tipping}
                    className={clsx(
                      "flex items-center gap-2 p-2 rounded-lg border transition-all duration-200 text-left",
                      "active:scale-[0.97]",
                      justTipped === agent.id.toString()
                        ? ""
                        : "hover:border-poker-gold/25"
                    )}
                    style={justTipped === agent.id.toString() ? {
                      background: "linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(212, 175, 55, 0.03))",
                      border: "1px solid rgba(212, 175, 55, 0.3)",
                    } : {
                      background: "linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.1))",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${agent.color}20, ${agent.color}10)`,
                        border: `1px solid ${agent.color}25`,
                      }}
                    >
                      {agent.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-white/90 truncate">
                          {agent.name}
                        </span>
                        {justTipped === agent.id.toString() && (
                          <CheckCircle className="w-3 h-3 text-poker-gold shrink-0" style={{
                            filter: "drop-shadow(0 0 4px rgba(212, 175, 55, 0.4))",
                          }} />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">$0.05 USDC</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Recent tips list */}
              {tips.length > 0 && (
                <div>
                  <h4 className="text-[10px] text-gray-500 uppercase tracking-[0.15em] mb-2">
                    Recent Tips
                  </h4>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {tips.slice(0, 5).map((tip) => (
                      <div
                        key={tip.id}
                        className="flex items-center justify-between text-[10px] px-2 py-1 rounded"
                        style={{
                          background: "rgba(0,0,0,0.2)",
                          border: "1px solid rgba(255,255,255,0.03)",
                        }}
                      >
                        <span className="text-gray-400">
                          Tipped <span className="text-white/80 font-medium">{tip.agentName}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono" style={{
                            color: "#D4AF37",
                            textShadow: "0 0 6px rgba(212, 175, 55, 0.2)",
                          }}>${tip.amount}</span>
                          <span className="text-gray-600">{formatTime(tip.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
