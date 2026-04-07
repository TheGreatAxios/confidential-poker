import { useState } from "react";
import { useAccount } from "wagmi";
import { FRONTEND_CONFIG } from "@/lib/config";

export function FaucetPanel() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClaim = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      if (!address) throw new Error("Connect wallet to claim sFUEL");
      const apiUrl = FRONTEND_CONFIG.apiUrl;

      if (!apiUrl) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setMessage("✅ sFUEL demo claim complete.");
        return;
      }

      const res = await fetch(`${apiUrl}/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      setMessage(data.txHash ? "✅ sFUEL sent!" : "✅ Claimed!");
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
