import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import {
  POKER_GAME_ABI,
  isContractDeployed,
} from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
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

const SUITS: Record<number, Card["suit"]> = {
  0: "♣",
  1: "♦",
  2: "♥",
  3: "♠",
};

const RANKS: Record<number, Card["rank"]> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function cardFromUint8(c: number): Card | null {
  if (c === 0) return null;

  const rank = c & 0x0f;
  const suit = (c >> 4) & 0x03;
  if (rank < 2 || rank > 14 || !(suit in SUITS)) {
    return null;
  }

  return {
    suit: SUITS[suit],
    rank: RANKS[rank],
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
  chipTokenAddress: `0x${string}` | null;
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

export function usePokerTable(tableAddress: `0x${string}`): PokerTableState {
  const contractReady = isContractDeployed(tableAddress);

  const { data, isLoading, isError, error, refetch } = useReadContracts({
    contracts: [
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "phase",
      },
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "pot",
      },
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "currentBet",
      },
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "handNumber",
      },
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "playerCount",
      },
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "getCommunityCards",
      },
      {
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "gameToken",
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
        chipTokenAddress: null,
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
    const chipTokenAddress = typeof data[6]?.result === "string"
      ? data[6].result as `0x${string}`
      : null;

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
      chipTokenAddress,
      isSuccess: true,
      isLoading,
      error: null,
      refetch: () => refetch(),
    };
  }, [data, isError, error, isLoading, refetch, contractReady]);
}
