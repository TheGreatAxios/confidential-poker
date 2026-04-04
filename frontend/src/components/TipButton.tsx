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
    <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden backdrop-blur-sm">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400" />
          Tip an Agent
          <span className="text-[10px] text-poker-gold font-mono bg-poker-gold/10 px-1.5 py-0.5 rounded">
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Agent tip buttons */}
              <div className="grid grid-cols-2 gap-2">
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleTip(agent.id)}
                    disabled={tipping}
                    className={clsx(
                      "flex items-center gap-2 p-2 rounded-lg border transition-all duration-200 text-left",
                      "bg-black/20 border-white/5 hover:border-poker-gold/30 hover:bg-poker-gold/5",
                      "active:scale-[0.97]",
                      justTipped === agent.id.toString() && "border-poker-gold/40 bg-poker-gold/10"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: agent.color + "20" }}
                    >
                      {agent.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-white truncate">
                          {agent.name}
                        </span>
                        {justTipped === agent.id.toString() && (
                          <CheckCircle className="w-3 h-3 text-poker-gold shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">$0.05 USDC</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Recent tips */}
              {tips.length > 0 && (
                <div>
                  <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                    Recent Tips
                  </h4>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {tips.slice(0, 5).map((tip) => (
                      <div
                        key={tip.id}
                        className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-black/20"
                      >
                        <span className="text-gray-400">
                          Tipped <span className="text-white font-medium">{tip.agentName}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-poker-gold font-mono">${tip.amount}</span>
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
