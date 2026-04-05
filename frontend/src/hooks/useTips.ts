"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { AGENTS } from "@/lib/constants";

export interface TipRecord {
  id: string;
  agentId: number;
  agentName: string;
  amount: number;
  timestamp: string;
  txHash?: string;
}

export function useTips() {
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipping, setTipping] = useState(false);

  const fetchTips = useCallback(async () => {
    try {
      const data = await api.getTipHistory();
      setTips(Array.isArray(data) ? (data as TipRecord[]) : []);
    } catch {
      // Server unavailable — keep existing tips or stay empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTips();
    const interval = setInterval(fetchTips, 10000);
    return () => clearInterval(interval);
  }, [fetchTips]);

  const sendTip = async (agentId: number, amount: number = 0.05) => {
    setTipping(true);
    try {
      await api.tipAgent(agentId, amount);
      const agent = AGENTS.find((a) => a.id === agentId);
      const newTip: TipRecord = {
        id: Date.now().toString(),
        agentId,
        agentName: agent?.name ?? "Unknown",
        amount,
        timestamp: new Date().toISOString(),
      };
      setTips((prev) => [newTip, ...prev]);
    } catch {
      // Tip failed — don't add fake record
    } finally {
      setTipping(false);
    }
  };

  return { tips, loading, tipping, sendTip, refetch: fetchTips };
}
