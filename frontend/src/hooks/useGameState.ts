"use client";

import { useEffect, useState, useCallback } from "react";
import { useReadContracts, useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { POKER_TABLE_ABI } from "@/lib/abis";
import { CONTRACTS } from "@/lib/wagmi";
import type { GameState, PlayerState, RawPlayer, Phase } from "@/lib/types";
import { PHASE_MAP } from "@/lib/types";

/** Polling interval in ms */
const POLL_INTERVAL = 2_000;

export function useGameState() {
  const { address: connectedAddress } = useAccount();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetchKey, setRefetchKey] = useState(0);

  const contractAddress = CONTRACTS.pokerTable;
  const enabled = contractAddress !== "0x0000000000000000000000000000000000000000";

  // Batch all contract reads into a single multicall
  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "phase" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "pot" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "handCount" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "dealerIndex" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "activePlayerIndex" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "smallBlind" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "bigBlind" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "maxPlayers" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "minBuyIn" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "currentMaxBet" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "getPlayers" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "getCommunityCards" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "getSeatedPlayerCount" },
      { address: contractAddress, abi: POKER_TABLE_ABI, functionName: "getActivePlayerCount" },
    ] as const,
    query: {
      enabled,
      refetchInterval: POLL_INTERVAL,
    },
  });

  // Map contract data → GameState whenever data changes
  useEffect(() => {
    if (!data || !enabled) return;

    const results = data.map((r) => (r.status === "success" ? r.result : null));
    const [
      phaseNum, pot, handCount, dealerIndex, activePlayerIndex,
      smallBlind, bigBlind, maxPlayers, minBuyIn, currentMaxBet,
      rawPlayers, rawCommunityCards, seatedCount, activeCount,
    ] = results;

    if (phaseNum === null || !rawPlayers) return;

    const phase: Phase = PHASE_MAP[Number(phaseNum)] ?? "Waiting";
    const players: RawPlayer[] = (rawPlayers as unknown as RawPlayer[]) || [];

    // Validate rawPlayers have expected fields before processing
    if (players.length > 0 && typeof players[0].addr === "undefined") return;

    // Filter to only seated players
    const seatedPlayers = players.filter((p) => p.isSeated);
    const dealerIdx = Number(dealerIndex ?? 0n);
    const activeIdx = Number(activePlayerIndex ?? 0n);

    const dealerAddr = (players.length > 0 && players[dealerIdx])
      ? players[dealerIdx].addr
      : ("0x0000000000000000000000000000000000000000" as `0x${string}`);
    const activeAddr = (players.length > 0 && players[activeIdx])
      ? players[activeIdx].addr
      : ("0x0000000000000000000000000000000000000000" as `0x${string}`);

    // Build PlayerState array
    const playerStates: PlayerState[] = players.map((p, idx) => ({
      address: p.addr,
      stack: p.stack,
      currentBet: p.currentBet,
      folded: p.folded,
      hasActed: p.hasActed,
      holeCards: p.holeCards,
      isSeated: p.isSeated,
      isDealer: idx === dealerIdx,
      isActive: idx === activeIdx,
      isWinner: false, // determined by events, not state
    }));

    // Community cards (uint8 encoded values)
    const communityCards = Array.isArray(rawCommunityCards)
      ? (rawCommunityCards as bigint[]).map(Number)
      : [];

    // Connected wallet checks
    const isConnectedSeated = connectedAddress
      ? seatedPlayers.some((p) => p.addr.toLowerCase() === connectedAddress.toLowerCase())
      : false;

    const isMyTurn = connectedAddress && activeAddr
      ? activeAddr.toLowerCase() === connectedAddress.toLowerCase()
      : false;

    setGame({
      phase,
      pot: BigInt(pot as bigint ?? 0n),
      handNumber: BigInt(handCount as bigint ?? 0n),
      communityCards,
      players: playerStates,
      activePlayerAddress: activeAddr,
      dealerAddress: dealerAddr,
      smallBlind: BigInt(smallBlind as bigint ?? 0n),
      bigBlind: BigInt(bigBlind as bigint ?? 0n),
      maxPlayers: BigInt(maxPlayers as bigint ?? 0n),
      minBuyIn: BigInt(minBuyIn as bigint ?? 0n),
      currentMaxBet: BigInt(currentMaxBet as bigint ?? 0n),
      seatedPlayerCount: Number(seatedCount as number ?? seatedPlayers.length),
      activePlayerCount: Number(activeCount as number ?? 0),
      isConnectedSeated,
      isMyTurn,
    });

    if (loading) setLoading(false);
  }, [data, enabled, connectedAddress, loading]);

  // External refetch trigger
  useEffect(() => {
    if (refetchKey > 0) {
      refetch();
    }
  }, [refetchKey, refetch]);

  const triggerRefetch = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  return { game, loading: isLoading || loading, isError, refetch: triggerRefetch };
}
