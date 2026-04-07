
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { Card, GameState } from "@/lib/types";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS } from "@/lib/contracts";
import { cardFromUint8, usePokerTable } from "@/hooks/usePokerTable";
import { FRONTEND_CONFIG } from "@/lib/config";
import { loadViewerKey } from "@/lib/viewer-key";
import { decryptEncryptedCards } from "@/lib/encrypted-cards";

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
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const MAX_SEATS = 6;
const NO_TURN = (2n ** 256n) - 1n;

const ALL_SEAT_CONTRACTS = Array.from({ length: MAX_SEATS }, (_, i) => ({
  chainId: FRONTEND_CONFIG.chainId,
  address: POKER_TABLE_ADDRESS,
  abi: POKER_TABLE_ABI,
  functionName: "getPlayer" as const,
  args: [BigInt(i)] as const,
}));

const ALL_PLAYER_INFO_CONTRACTS = Array.from({ length: MAX_SEATS }, (_, i) => ({
  chainId: FRONTEND_CONFIG.chainId,
  address: POKER_TABLE_ADDRESS,
  abi: POKER_TABLE_ABI,
  functionName: "getPlayerInfo" as const,
  args: [BigInt(i)] as const,
}));

export function useGameState() {
  const { address, isConnected: isWalletConnected } = useAccount();
  const table = usePokerTable();
  const [pendingJoinAddress, setPendingJoinAddress] = useState<`0x${string}` | null>(null);
  const [holeCards, setHoleCards] = useState<Card[]>([]);

  const { data: playerAddressReads, refetch: refetchPlayers } = useReadContracts({
    contracts: ALL_SEAT_CONTRACTS,
    query: {
      enabled: true,
      refetchInterval: 5_000,
    },
  });

  const { data: dealerAddress, refetch: refetchDealer } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "dealer",
    query: {
      enabled: table.isSuccess,
      refetchInterval: 5_000,
    },
  });

  const { data: turnIndexRead, refetch: refetchTurnIndex } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "getCurrentTurnIndex",
    query: {
      enabled: table.isSuccess,
      refetchInterval: 5_000,
    },
  });

  const { data: playerInfoReads, refetch: refetchPlayerInfo } = useReadContracts({
    contracts: ALL_PLAYER_INFO_CONTRACTS,
    query: {
      enabled: true,
      refetchInterval: 5_000,
    },
  });

  const playerAddresses = useMemo(
    () =>
      (playerAddressReads ?? [])
        .map((entry) => entry.result)
        .filter(
          (value): value is `0x${string}` =>
            typeof value === "string" && value.toLowerCase() !== ZERO_ADDRESS,
        ),
    [playerAddressReads],
  );

  const playerInfo = useMemo(() => {
    return (playerInfoReads ?? []).map((entry) =>
      entry.status === "success"
        ? (entry.result as readonly [`0x${string}`, boolean, boolean, bigint, boolean, bigint])
        : null,
    );
  }, [playerInfoReads]);

  const normalizedAddress = address?.toLowerCase();
  const hasHumanSeat = !!normalizedAddress && playerAddresses.some((p) => p.toLowerCase() === normalizedAddress);
  const humanAddress = hasHumanSeat ? address : pendingJoinAddress;
  const viewerKey = useMemo(() => loadViewerKey(address), [address]);

  const { data: encryptedHoleCards } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "getMyEncryptedCards",
    account: address,
    query: {
      enabled: hasHumanSeat && !!address,
      refetchInterval: 5_000,
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function syncHoleCards() {
      if (!hasHumanSeat || !address || typeof encryptedHoleCards !== "string" || encryptedHoleCards === "0x") {
        if (!cancelled) {
          setHoleCards([]);
        }
        return;
      }

      const viewerKey = loadViewerKey(address);
      if (!viewerKey) {
        if (!cancelled) {
          setHoleCards([]);
        }
        return;
      }

      try {
        const [card1, card2] = await decryptEncryptedCards(viewerKey.privateKey, encryptedHoleCards);
        const nextHoleCards = [cardFromUint8(card1), cardFromUint8(card2)].filter(
          (card): card is NonNullable<typeof card> => card !== null,
        );

        if (!cancelled) {
          setHoleCards(nextHoleCards);
        }
      } catch {
        if (!cancelled) {
          setHoleCards([]);
        }
      }
    }

    void syncHoleCards();

    return () => {
      cancelled = true;
    };
  }, [address, encryptedHoleCards, hasHumanSeat, table.handNumber]);

  const gameState = useMemo<GameState>(() => {
    const dealer = typeof dealerAddress === "string" ? dealerAddress.toLowerCase() : null;
    const currentTurnIndex =
      typeof turnIndexRead === "bigint" && turnIndexRead !== NO_TURN ? Number(turnIndexRead) : null;
    const isTableEmpty = table.playerCount === 0n;
    const isWaiting = table.phase === "waiting";
    const agents = playerAddresses.map((playerAddress, i) => {
      const info = playerInfo[i];
      const currentBet = info ? info[3] : 0n;
      const chips = info ? info[5] : 0n;
      const isActive = info ? info[1] : false;
      const isAllIn = info ? info[4] : false;
      const status = !isActive
        ? ("folded" as const)
        : isAllIn
          ? ("all-in" as const)
          : currentTurnIndex === i
            ? ("acting" as const)
          : ("waiting" as const);

      return {
        id: `agent-${i}`,
        name: `${playerAddress.slice(0, 6)}...${playerAddress.slice(-4)}`,
        personality: PERSONALITIES[i % PERSONALITIES.length],
        emoji: EMOJIS[i % EMOJIS.length] ?? "🧠",
        chips,
        cards: playerAddress.toLowerCase() === normalizedAddress ? holeCards : [],
        status,
        currentBet,
        isDealer: dealer === playerAddress.toLowerCase(),
        isThinking: currentTurnIndex === i,
        message: null,
        seatIndex: i,
        winRate: 0,
        handsPlayed: Number(table.handNumber),
        color: COLORS[i % COLORS.length] ?? "#6b7280",
      };
    });

    const dealerIndex = agents.findIndex((agent) => agent.isDealer);
    const normalizedCurrentBet = isTableEmpty || isWaiting ? 0n : table.currentBet ?? 0n;
    const minRaise = normalizedCurrentBet > 0n ? normalizedCurrentBet : 500_000_000_000_000_000n;
    const humanSeatIndex = normalizedAddress
      ? playerAddresses.findIndex((p) => p.toLowerCase() === normalizedAddress)
      : -1;
    const humanInfo = humanSeatIndex >= 0 ? playerInfo[humanSeatIndex] : null;
    const humanStatus = humanInfo
      ? humanInfo[4]
        ? "all-in"
        : !humanInfo[1]
          ? "folded"
          : currentTurnIndex === humanSeatIndex
            ? "acting"
            : "waiting"
      : "waiting";

    return {
      phase: table.phase,
      communityCards: table.communityCards,
      pot: isTableEmpty || isWaiting ? 0n : table.pot,
      currentBet: normalizedCurrentBet,
      minRaise,
      dealerIndex: dealerIndex >= 0 ? dealerIndex : 0,
      currentPlayerIndex: currentTurnIndex,
      agents,
      handNumber: Number(table.handNumber),
      roundNumber: 0,
      lastAction: null,
      winners: null,
      humanPlayer: humanAddress
        ? {
            isConnected: isWalletConnected,
            address: humanAddress,
            viewerKey: viewerKey?.publicKey ?? null,
            chips: humanInfo ? humanInfo[5] : 0n,
            cards: holeCards,
            status: humanStatus,
            currentBet: humanInfo ? humanInfo[3] : 0n,
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
    playerInfo,
    turnIndexRead,
    viewerKey,
  ]);

  const errorMessage = table.error?.message ?? null;
  const isLive = table.isSuccess;
  const refetch = useCallback(() => {
    table.refetch();
    refetchPlayers();
    refetchDealer();
    refetchTurnIndex();
    refetchPlayerInfo();
  }, [table, refetchPlayers, refetchDealer, refetchTurnIndex, refetchPlayerInfo]);

  const joinHumanPlayer = useCallback(
    (joinedAddress: `0x${string}`) => {
      setPendingJoinAddress(joinedAddress);
      refetch();
    },
    [refetch],
  );

  const leaveHumanPlayer = useCallback(() => {
    setPendingJoinAddress(null);
    refetch();
  }, [refetch]);

  return {
    gameState,
    isConnected: isLive,
    error: errorMessage,
    refetch,
    joinHumanPlayer,
    leaveHumanPlayer,
  };
}
