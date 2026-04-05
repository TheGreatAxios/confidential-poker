"use client";

import { useState } from "react";

export function FaucetPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClaim = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl) {
        const res = await fetch(`${apiUrl}/faucet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: "demo-player" }),
        });
        const data = await res.json();
        setMessage(data.txHash ? `✅ sFUEL sent!` : "✅ Claimed!");
      } else {
        // Demo mode
        await new Promise((r) => setTimeout(r, 1000));
        setMessage("✅ Demo: 1000 sFUEL claimed!");
      }
    } catch {
      setMessage("❌ Claim failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClaim}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg bg-poker-purple/20 border border-poker-purple/30 text-poker-purple text-sm font-semibold hover:bg-poker-purple/30 transition-colors disabled:opacity-50"
      >
        {isLoading ? "Claiming..." : "💧 Claim sFUEL"}
      </button>
      {message && (
        <span className="text-xs text-gray-400 animate-fade-in">{message}</span>
      )}
    </div>
  );
}
