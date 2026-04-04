"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AI Poker Night] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">
            Table Malfunction
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Something went wrong at the poker table. The dealer is shuffling
            the deck to try again.
          </p>
        </div>

        {error.message && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-gray-500 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-poker-goldDark to-poker-gold text-black
            shadow-lg shadow-poker-gold/20
            hover:shadow-poker-gold/40 transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
          Deal Again
        </motion.button>

        <p className="text-[10px] text-gray-600">
          AI Poker Night · SKALE Network
        </p>
      </motion.div>
    </div>
  );
}
