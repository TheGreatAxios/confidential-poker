import { useState, useCallback } from "react";
import { FaucetState } from "@/lib/types";

const FAUCET_URL = process.env.NEXT_PUBLIC_FAUCET_URL || "";
const MOCK_DELAY = 1500;

export function useFaucet() {
  const [state, setState] = useState<FaucetState>({
    isLoading: false,
    txHash: null,
    error: null,
    lastClaim: null,
  });

  const claimFuel = useCallback(async (address: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, txHash: null }));

    if (!FAUCET_URL) {
      // Mock claim
      await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
      const mockTxHash = `0x${Math.random().toString(16).slice(2, 66)}`;
      setState({
        isLoading: false,
        txHash: mockTxHash,
        error: null,
        lastClaim: Date.now(),
      });
      return mockTxHash;
    }

    try {
      const res = await fetch(FAUCET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        isLoading: false,
        txHash: data.txHash,
        error: null,
        lastClaim: Date.now(),
      });
      return data.txHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Faucet claim failed";
      setState((prev) => ({ ...prev, isLoading: false, error: msg }));
      return null;
    }
  }, []);

  return { ...state, claimFuel };
}
