import { createElement, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ensureAppKit } from "@/lib/appkit";

export function WalletConnectButton() {
  const { isConnected } = useAccount();
  const [isAppKitReady, setIsAppKitReady] = useState(isConnected);

  useEffect(() => {
    if (isConnected) {
      setIsAppKitReady(true);
      return;
    }
    let cancelled = false;
    void ensureAppKit().then(() => {
      if (!cancelled) setIsAppKitReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  if (isAppKitReady) {
    return createElement("appkit-button");
  }

  return (
    <button
      disabled
      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-poker-text-muted opacity-70"
    >
      Loading wallet...
    </button>
  );
}
