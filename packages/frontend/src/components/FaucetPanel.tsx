import { useState } from "react";
import { useAccount } from "wagmi";

export function FaucetPanel() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClaim = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      if (!address) throw new Error("Connect wallet to claim sFUEL");
      await new Promise((resolve) => setTimeout(resolve, 800));
      setMessage("sFUEL demo claim complete.");
    } catch {
      setMessage("Claim failed. Try again.");
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
        {isLoading ? "Claiming..." : "Claim sFUEL"}
      </button>
      {message && (
        <span className="text-xs text-gray-400 animate-fade-in">{message}</span>
      )}
    </div>
  );
}
