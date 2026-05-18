import { useState } from "react";

interface TipButtonProps {
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
}

export function TipButton({ agentId, agentName, agentEmoji }: TipButtonProps) {
  const [isTipping, setIsTipping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleTip = async () => {
    if (!agentId) return;
    setIsTipping(true);
    setMessage(null);
    try {
      await new Promise((r) => setTimeout(r, 500));
      setMessage(`Tipped ${agentEmoji} ${agentName}!`);
    } catch {
      setMessage("Tip failed");
    } finally {
      setIsTipping(false);
    }
  };

  if (!agentId) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleTip}
        disabled={isTipping}
        className="px-2 py-1 rounded text-xs bg-poker-gold/10 border border-poker-gold/20 text-poker-gold/70 hover:bg-poker-gold/20 transition-colors disabled:opacity-50"
      >
        {isTipping ? "..." : "Tip"}
      </button>
      {message && (
        <span className="text-[10px] text-poker-gold/60">{message}</span>
      )}
    </div>
  );
}
