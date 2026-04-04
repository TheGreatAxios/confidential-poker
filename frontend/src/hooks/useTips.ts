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

const DEMO_TIPS: TipRecord[] = [
  {
    id: "1",
    agentId: 1,
    agentName: "Rage Bot",
    amount: 0.05,
    timestamp: new Date(Date.now() - 120000).toISOString(),
    txHash: "0x1234...abcd",
  },
  {
    id: "2",
    agentId: 3,
    agentName: "Bluffer",
    amount: 0.05,
    timestamp: new Date(Date.now() - 300000).toISOString(),
    txHash: "0x5678...efgh",
  },
];

export function useTips() {
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipping, setTipping] = useState(false);

  const fetchTips = useCallback(async () => {
    try {
      const data = await api.getTipHistory();
      setTips(Array.isArray(data) ? data : data.tips ?? []);
    } catch {
      if (tips.length === 0) {
        setTips(DEMO_TIPS);
      }
    } finally {
      setLoading(false);
    }
  }, [tips.length]);

  useEffect(() => {
    fetchTips();
    const interval = setInterval(fetchTips, 10000);
    return () => clearInterval(interval);
  }, [fetchTips]);

  const sendTip = async (agentId: number, amount: number = 0.05) => {
    setTipping(true);
    try {
      const result = await api.tipAgent(agentId, amount);
      const agent = AGENTS.find((a) => a.id === agentId);
      const newTip: TipRecord = {
        id: Date.now().toString(),
        agentId,
        agentName: agent?.name ?? "Unknown",
        amount,
        timestamp: new Date().toISOString(),
        txHash: result?.txHash,
      };
      setTips((prev) => [newTip, ...prev]);
    } catch {
      // Simulate tip in demo mode — mark as demo, not a real tx
      const agent = AGENTS.find((a) => a.id === agentId);
      const newTip: TipRecord = {
        id: Date.now().toString(),
        agentId,
        agentName: agent?.name ?? "Unknown",
        amount,
        timestamp: new Date().toISOString(),
        isDemo: true,
      };
      setTips((prev) => [newTip, ...prev]);
    } finally {
      setTipping(false);
    }
  };

  return { tips, loading, tipping, sendTip, refetch: fetchTips };
}
