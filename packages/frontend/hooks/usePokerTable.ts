"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts, useAccount } from "wagmi";
import {
  POKER_TABLE_ABI,
  POKER_TABLE_ADDRESS,
  isContractDeployed,
} from "@/lib/contracts";
import type { GamePhase, Card } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** Map contract uint8 phase to our GamePhase type */
const PHASE_MAP: Record<number, GamePhase> = {
  0: "waiting",
  1: "preflop",
  2: "flop",
  3: "turn",
  4: "river",
  5: "showdown",
};

export function phaseFromContract(phase: number): GamePhase {
  return PHASE_MAP[phase] ?? "waiting";
}

/** Map a uint8 card encoding (0–51) to a Card object.
 *  Encoding: suit = floor(card / 13), rank = card % 13
 *  Suits: 0=♠ 1=♥ 2=♦ 3=♣   Ranks: 0=2 … 12=A */
const SUITS: Card["suit"][] = ["♠", "♥", "♦", "♣"];
const RANKS: Card["rank"][] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

export function cardFromUint8(c: number): Card | null {
  if (c === 0 || c > 51) return null;
  return {
    suit: SUITS[Math.floor(c / 13)] ?? "♠",
    rank: RANKS[c % 13] ?? "2",
    faceUp: true,
  };
}

// ── Hook Return Type ─────────────────────────────────────────────────────────────

export interface PokerTableState {
  phase: GamePhase;
  pot: bigint;
  currentBet: bigint;
  handNumber: bigint;
  playerCount: bigint;
  communityCards: Card[];
  /** Contract reads were successful */
  isSuccess: boolean;
  /** Contract reads are loading */
  isLoading: boolean;
  /** Error from contract reads, if any */
  error: Error | null;
  /** Refetch all reads */
  refetch: () => void;
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function usePokerTable(): PokerTableState {
  const contractReady = isContractDeployed(POKER_TABLE_ADDRESS);

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts: [
      {
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "phase",
      },
      {
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "pot",
      },
      {
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "currentBet",
      },
      {
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "handNumber",
      },
      {
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "playerCount",
      },
      {
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "getCommunityCards",
      },
    ],
    query: {
      enabled: contractReady,
      refetchInterval: 5_000,
    },
  });

  // Parse the multi-call results
  return useMemo<PokerTableState>(() => {
    if (!data || isError || !contractReady) {
      return {
        phase: "waiting",
        pot: 0n,
        currentBet: 0n,
        handNumber: 0n,
        playerCount: 0n,
        communityCards: [],
        isSuccess: false,
        isLoading,
        error: error ?? null,
        refetch: () => refetch(),
      };
    }

    // Each result has .result, .status, .error
    const phase = data[0]?.result as number | undefined;
    const pot = data[1]?.result as bigint | undefined;
    const currentBet = data[2]?.result as bigint | undefined;
    const handNumber = data[3]?.result as bigint | undefined;
    const playerCount = data[4]?.result as bigint | undefined;
    const rawCommunity = data[5]?.result as number[] | undefined;

    // Map community cards (uint8[5]) to Card objects
    const communityCards: Card[] = [];
    if (Array.isArray(rawCommunity)) {
      for (const c of rawCommunity) {
        const card = cardFromUint8(c);
        if (card) communityCards.push(card);
      }
    }

    return {
      phase: phaseFromContract(phase ?? 0),
      pot: pot ?? 0n,
      currentBet: currentBet ?? 0n,
      handNumber: handNumber ?? 0n,
      playerCount: playerCount ?? 0n,
      communityCards,
      isSuccess: true,
      isLoading,
      error: null,
      refetch: () => refetch(),
    };
  }, [data, isError, error, isLoading, refetch, contractReady]);
}

// ── Individual read: player's hole cards ─────────────────────────────────────────

export function useMyHoleCards() {
  const { isConnected } = useAccount();

  return useReadContract({
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "getMyHoleCards",
    query: {
      enabled: isConnected && isContractDeployed(POKER_TABLE_ADDRESS),
    },
  });
}
