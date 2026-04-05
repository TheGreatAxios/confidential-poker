"use client";

import { useState } from "react";

export function JoinPanel() {
  const [address, setAddress] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!address) return;
    setIsJoining(true);
    setMessage(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl) {
        const res = await fetch(`${apiUrl}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const data = await res.json();
        setMessage(`✅ Joined as seat #${data.seatIndex ?? "?"}`);
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        setMessage("✅ Demo mode — joined the table!");
      }
    } catch {
      setMessage("❌ Failed to join");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... (wallet address)"
          className="w-48 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-poker-gold/50"
        />
      </div>
      <button
        onClick={handleJoin}
        disabled={isJoining || !address}
        className="px-4 py-2 rounded-lg bg-poker-gold/20 border border-poker-gold/30 text-poker-gold text-sm font-semibold hover:bg-poker-gold/30 transition-colors disabled:opacity-50"
      >
        {isJoining ? "Joining..." : "Join Table"}
      </button>
      {message && (
        <span className="text-xs text-gray-400 animate-fade-in">{message}</span>
      )}
    </div>
  );
}
