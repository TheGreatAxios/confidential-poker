"use client";

import { useState, useMemo, useCallback } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { GameState } from "@/lib/types";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS } from "@/lib/contracts";
import { cardFromUint8, useMyHoleCards, usePokerTable } from "@/hooks/usePokerTable";

const PERSONALITIES: GameState["agents"][number]["personality"][] = [
  "aggressive",
  "cautious",
  "bluffer",
  "calculator",
  "tight",
  "loose",
];

const EMOJIS = ["🔥", "🛡️", "🎭", "🧮", "🔒", "🎲"];
const COLORS = ["#e53e3e", "#4299e1", "#9f7aea", "#38a169", "#f0b429", "#ed64a6"];

export function useGameState() {
  const { address, isConnected: isWalletConnected } = useAccount();
  const table = usePokerTable();
  const { data: holeCardsData } = useMyHoleCards();
  const [pendingJoinAddress, setPendingJoinAddress] = useState<`0x${string}` | null>(null);

  const playerCount = Number(table.playerCount);
  const safePlayerCount = Number.isFinite(playerCount) ? Math.max(0, Math.min(playerCount, 6)) : 0;

  const playerContracts = useMemo(
    () =>
      Array.from({ length: safePlayerCount }, (_, i) => ({
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "getPlayer" as const,
        args: [BigInt(i)] as const,
      })),
    [safePlayerCount],
  );

  const { data: playerAddressReads, refetch: refetchPlayers } = useReadContracts({
    contracts: playerContracts,
    query: {
      enabled: table.isSuccess && playerContracts.length > 0,
      refetchInterval: 5_000,
    },
  });

  const { data: dealerAddress, refetch: refetchDealer } = useReadContract({
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "dealer",
    query: {
      enabled: table.isSuccess,
      refetchInterval: 5_000,
    },
  });

  const playerAddresses = useMemo(
    () =>
      (playerAddressReads ?? [])
        .map((entry) => entry.result)
        .filter((value): value is `0x${string}` => typeof value === "string"),
    [playerAddressReads],
  );

  const normalizedAddress = address?.toLowerCase();
  const hasHumanSeat = !!normalizedAddress && playerAddresses.some((p) => p.toLowerCase() === normalizedAddress);
  const humanAddress = hasHumanSeat ? address : pendingJoinAddress;

  const joinHumanPlayer = useCallback((address: `0x${string}`) => {
    setPendingJoinAddress(address);
  }, []);

  const holeCards = useMemo(() => {
    if (!Array.isArray(holeCardsData) || holeCardsData.length < 2) return [];
    const card1 = cardFromUint8(Number(holeCardsData[0]));
    const card2 = cardFromUint8(Number(holeCardsData[1]));
    return [card1, card2].filter((card): card is NonNullable<typeof card> => !!card);
  }, [holeCardsData]);

  const gameState = useMemo<GameState>(() => {
    const dealer = typeof dealerAddress === "string" ? dealerAddress.toLowerCase() : null;
    const agents = playerAddresses.map((playerAddress, i) => ({
      id: `agent-${i}`,
      name: `${playerAddress.slice(0, 6)}...${playerAddress.slice(-4)}`,
      personality: PERSONALITIES[i % PERSONALITIES.length],
      emoji: EMOJIS[i % EMOJIS.length] ?? "🧠",
      chips: 0,
      cards: [],
      status: "waiting" as const,
      currentBet: 0,
      isDealer: dealer === playerAddress.toLowerCase(),
      isThinking: false,
      message: null,
      seatIndex: i,
      winRate: 0,
      handsPlayed: Number(table.handNumber),
      color: COLORS[i % COLORS.length] ?? "#6b7280",
    }));

    const dealerIndex = agents.findIndex((agent) => agent.isDealer);
    const currentBet = Number(table.currentBet);
    const normalizedCurrentBet = Number.isFinite(currentBet) ? currentBet : 0;
    const minRaise = normalizedCurrentBet > 0 ? normalizedCurrentBet : 1;
    const humanSeatIndex = normalizedAddress
      ? playerAddresses.findIndex((p) => p.toLowerCase() === normalizedAddress)
      : -1;

    return {
      phase: table.phase,
      communityCards: table.communityCards,
      pot: Number(table.pot),
      currentBet: normalizedCurrentBet,
      minRaise,
      dealerIndex: dealerIndex >= 0 ? dealerIndex : 0,
      currentPlayerIndex: null,
      agents,
      handNumber: Number(table.handNumber),
      roundNumber: 0,
      lastAction: null,
      winners: null,
      humanPlayer: humanAddress
        ? {
            isConnected: isWalletConnected,
            address: humanAddress,
            chips: 0,
            cards: holeCards,
            status: "waiting",
            currentBet: 0,
            seatIndex: humanSeatIndex >= 0 ? humanSeatIndex : 6,
          }
        : null,
    };
  }, [
    dealerAddress,
    holeCards,
    humanAddress,
    isWalletConnected,
    normalizedAddress,
    playerAddresses,
    table.communityCards,
    table.currentBet,
    table.handNumber,
    table.phase,
    table.pot,
  ]);

  const errorMessage = table.error?.message ?? null;
  const isLive = table.isSuccess;
  const refetch = useCallback(() => {
    table.refetch();
    refetchPlayers();
    refetchDealer();
  }, [table, refetchPlayers, refetchDealer]);

  return {
    gameState,
    isConnected: isLive,
    error: errorMessage,
    refetch,
    joinHumanPlayer,
  };
}
