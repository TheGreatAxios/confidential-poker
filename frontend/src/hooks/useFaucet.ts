"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCooldown } from "@/lib/format";

export interface FaucetState {
  msklBalance: number;
  axusdBalance: number;
  msklCooldown: number;
  axusdCooldown: number;
  lastMsklClaim: string | null;
  lastAxusdClaim: string | null;
  claimingMskl: boolean;
  claimingAxusd: boolean;
  error: string | null;
}

const DEFAULT_STATE: FaucetState = {
  msklBalance: 0,
  axusdBalance: 0,
  msklCooldown: 0,
  axusdCooldown: 0,
  lastMsklClaim: null,
  lastAxusdClaim: null,
  claimingMskl: false,
  claimingAxusd: false,
  error: null,
};

export function useFaucet(address: string = "") {
  const [state, setState] = useState<FaucetState>(DEFAULT_STATE);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    try {
      const data = await api.getFaucetBalances(address);
      setState((prev) => ({
        ...prev,
        msklBalance: data.mskl ?? 0,
        axusdBalance: data.axusd ?? 0,
        msklCooldown: data.msklCooldown ?? 0,
        axusdCooldown: data.axusdCooldown ?? 0,
      }));
    } catch {
      // Silently fail
    }
  }, [address]);

  // Cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        msklCooldown: Math.max(0, prev.msklCooldown - 1),
        axusdCooldown: Math.max(0, prev.axusdCooldown - 1),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const claimMskl = async () => {
    setState((prev) => ({ ...prev, claimingMskl: true, error: null }));
    try {
      await api.claimMskl(address);
      setState((prev) => ({
        ...prev,
        msklCooldown: 60,
        claimingMskl: false,
      }));
      await fetchBalances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setState((prev) => ({
        ...prev,
        claimingMskl: false,
        error: msg,
      }));
    }
  };

  const claimAxusd = async () => {
    setState((prev) => ({ ...prev, claimingAxusd: true, error: null }));
    try {
      await api.claimAxusd(address);
      setState((prev) => ({
        ...prev,
        axusdCooldown: 60,
        claimingAxusd: false,
      }));
      await fetchBalances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setState((prev) => ({
        ...prev,
        claimingAxusd: false,
        error: msg,
      }));
    }
  };

  return {
    ...state,
    msklCooldownText: formatCooldown(state.msklCooldown),
    axusdCooldownText: formatCooldown(state.axusdCooldown),
    canClaimMskl: state.msklCooldown === 0 && !state.claimingMskl,
    canClaimAxusd: state.axusdCooldown === 0 && !state.claimingAxusd,
    claimMskl,
    claimAxusd,
    refetch: fetchBalances,
  };
}
