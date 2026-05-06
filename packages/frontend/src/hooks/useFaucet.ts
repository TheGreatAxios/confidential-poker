import { useState, useCallback } from "react";
import { FaucetState } from "@/lib/types";

const MOCK_DELAY = 1500;

export function useFaucet() {
  const [state, setState] = useState<FaucetState>({
    isLoading: false,
    txHash: null,
    error: null,
    lastClaim: null,
  });

  const claimFuel = useCallback(async (_address: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, txHash: null }));

    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
    const mockTxHash = `0x${Math.random().toString(16).slice(2, 66)}`;
    setState({
      isLoading: false,
      txHash: mockTxHash,
      error: null,
      lastClaim: Date.now(),
    });
    return mockTxHash;
  }, []);

  return { ...state, claimFuel };
}
