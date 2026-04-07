import { useState, useMemo, useCallback, useEffect } from "react";
import { parseAbiItem } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { Card, GameState } from "@/lib/types";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS } from "@/lib/contracts";
import { cardFromUint8, usePokerTable } from "@/hooks/usePokerTable";
import { FRONTEND_CONFIG } from "@/lib/config";
import { loadViewerKey } from "@/lib/viewer-key";
import { decryptEncryptedCards } from "@/lib/encrypted-cards";
import { findWinningPlayerIds } from "@/lib/hand-evaluator";

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
const NO_TURN = (2n ** 256n) - 1n;
const CARDS_REVEALED_EVENT = parseAbiItem("event CardsRevealed(address indexed player, uint8 card1, uint8 card2)");

type PlayerRead = readonly [
  `0x${string}`,
  { x: `0x${string}`; y: `0x${string}` },
  boolean,
  boolean,
  bigint,
  boolean,
  bigint,
  `0x${string}`,
  `0x${string}`,
  boolean,
];

export function useGameState() {
  const { address, isConnected: isWalletConnected } = useAccount();
  const publicClient = usePublicClient();
  const table = usePokerTable();
  const [pendingJoinAddress, setPendingJoinAddress] = useState<`0x${string}` | null>(null);
  const [holeCards, setHoleCards] = useState<Card[]>([]);
  const [revealedCardsByAddress, setRevealedCardsByAddress] = useState<Record<string, Card[]>>({});
  const playerCount = Number(table.playerCount);

  const playerContracts = useMemo(
    () =>
      Array.from({ length: playerCount }, (_, i) => ({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "players" as const,
        args: [BigInt(i)] as const,
      })),
    [playerCount],
  );

  const { data: playerReads, refetch: refetchPlayers } = useReadContracts({
    contracts: playerContracts,
    query: {
      enabled: playerContracts.length > 0,
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

  const players = useMemo(() => {
    return (playerReads ?? []).map((entry, index) => {
      const player = entry.status === "success" ? (entry.result as PlayerRead) : null;
      if (!player) {
        return null;
      }

      const address = player[0];
      const currentBet = player[4];
      const chips = player[6];
      const cardsRevealed = player[9];
      const encryptedHoleCards = player[8];

      return {
        address,
        isActive: player[2],
        currentBet,
        isAllIn: player[5],
        chips,
        cardsRevealed,
        hadCardsThisHand: encryptedHoleCards !== "0x" || cardsRevealed,
        seatIndex: index,
      };
    });
  }, [playerReads]);

  const playerAddresses = useMemo(
    () => players.flatMap((player) => (player ? [player.address] : [])),
    [players],
  );

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

      const nextViewerKey = loadViewerKey(address);
      if (!nextViewerKey) {
        if (!cancelled) {
          setHoleCards([]);
        }
        return;
      }

      try {
        const [card1, card2] = await decryptEncryptedCards(nextViewerKey.privateKey, encryptedHoleCards);
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

  useEffect(() => {
    if (table.phase !== "waiting" || table.communityCards.length === 0) {
      setRevealedCardsByAddress({});
      return;
    }

    if (!publicClient) {
      return;
    }

    const client = publicClient;
    let cancelled = false;

    async function loadRevealedCards() {
      try {
        const latestBlock = await client.getBlockNumber();
        const fromBlock = latestBlock > 2_000n ? latestBlock - 2_000n : 0n;
        const logs = await client.getLogs({
          address: POKER_TABLE_ADDRESS,
          event: CARDS_REVEALED_EVENT,
          fromBlock,
          toBlock: "latest",
        });

        if (cancelled) {
          return;
        }

        const nextCards: Record<string, Card[]> = {};
        for (const log of logs) {
          const playerAddress = log.args.player?.toLowerCase();
          const card1 = typeof log.args.card1 === "number" ? log.args.card1 : Number(log.args.card1 ?? 0);
          const card2 = typeof log.args.card2 === "number" ? log.args.card2 : Number(log.args.card2 ?? 0);
          if (!playerAddress) {
            continue;
          }

          nextCards[playerAddress] = [cardFromUint8(card1), cardFromUint8(card2)].filter(
            (card): card is Card => card !== null,
          );
        }

        setRevealedCardsByAddress(nextCards);
      } catch {
        if (!cancelled) {
          setRevealedCardsByAddress({});
        }
      }
    }

    void loadRevealedCards();

    return () => {
      cancelled = true;
    };
  }, [publicClient, table.communityCards, table.phase]);

  const gameState = useMemo<GameState>(() => {
    const dealer = typeof dealerAddress === "string" ? dealerAddress.toLowerCase() : null;
    const currentTurnIndex =
      typeof turnIndexRead === "bigint" && turnIndexRead !== NO_TURN ? Number(turnIndexRead) : null;
    const isTableEmpty = table.playerCount === 0n;
    const isWaiting = table.phase === "waiting";
    const handComplete =
      table.phase === "showdown" ||
      (isWaiting && table.communityCards.length > 0 && players.some((player) => player?.hadCardsThisHand));

    const revealablePlayers = players.flatMap((player) => {
      if (!player) {
        return [];
      }

      const revealedCards = revealedCardsByAddress[player.address.toLowerCase()] ?? [];
      return revealedCards.length === 2 ? [{ id: `agent-${player.seatIndex}`, cards: revealedCards }] : [];
    });

    const winners =
      handComplete && revealablePlayers.length > 0
        ? findWinningPlayerIds(revealablePlayers, table.communityCards)
        : null;

    const agents = players.flatMap((player, i) => {
      if (!player) {
        return [];
      }

      const isHumanSeat = player.address.toLowerCase() === normalizedAddress;
      const revealedCards = revealedCardsByAddress[player.address.toLowerCase()] ?? [];
      let status: GameState["agents"][number]["status"] = "waiting";

      if (player.chips === 0n && !player.hadCardsThisHand) {
        status = "busted";
      } else if (!handComplete) {
        if (player.isActive) {
          status = player.isAllIn ? "all-in" : currentTurnIndex === i ? "acting" : "waiting";
        } else if (player.hadCardsThisHand) {
          status = "folded";
        }
      }

      return [
        {
          id: `agent-${i}`,
          name: `${player.address.slice(0, 6)}...${player.address.slice(-4)}`,
          personality: PERSONALITIES[i % PERSONALITIES.length],
          emoji: EMOJIS[i % EMOJIS.length] ?? "🧠",
          chips: player.chips,
          cards: revealedCards.length === 2 ? revealedCards : isHumanSeat ? holeCards : [],
          status,
          currentBet: player.currentBet,
          isDealer: dealer === player.address.toLowerCase(),
          isThinking: !handComplete && currentTurnIndex === i,
          isWinner: winners?.includes(`agent-${i}`) ?? false,
          cardsRevealed: revealedCards.length === 2,
          message: null,
          seatIndex: i,
          winRate: 0,
          handsPlayed: Number(table.handNumber),
          color: COLORS[i % COLORS.length] ?? "#6b7280",
        },
      ];
    });

    const dealerIndex = agents.findIndex((agent) => agent.isDealer);
    const normalizedCurrentBet = isTableEmpty || isWaiting ? 0n : table.currentBet ?? 0n;
    const minRaise = normalizedCurrentBet > 0n ? normalizedCurrentBet : 500_000_000_000_000_000n;
    const humanSeatIndex = normalizedAddress
      ? playerAddresses.findIndex((p) => p.toLowerCase() === normalizedAddress)
      : -1;
    const humanPlayerState = humanSeatIndex >= 0 ? players[humanSeatIndex] : null;
    const humanAgent = humanSeatIndex >= 0 ? agents[humanSeatIndex] : null;
    const humanRevealedCards =
      humanPlayerState ? revealedCardsByAddress[humanPlayerState.address.toLowerCase()] ?? [] : [];

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
      winners: winners && winners.length > 0 ? winners : null,
      canStartNextHand: isWaiting && players.filter((player) => player && player.chips > 0n).length >= 2,
      handComplete,
      humanPlayer: humanAddress
        ? {
            isConnected: isWalletConnected,
            address: humanAddress,
            viewerKey: viewerKey?.publicKey ?? null,
            chips: humanPlayerState ? humanPlayerState.chips : 0n,
            cards: humanRevealedCards.length === 2 ? humanRevealedCards : holeCards,
            status: humanAgent?.status ?? "waiting",
            currentBet: humanPlayerState ? humanPlayerState.currentBet : 0n,
            seatIndex: humanSeatIndex >= 0 ? humanSeatIndex : 6,
            isWinner: humanAgent?.isWinner ?? false,
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
    players,
    revealedCardsByAddress,
    table.communityCards,
    table.currentBet,
    table.handNumber,
    table.phase,
    table.pot,
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
  }, [table, refetchPlayers, refetchDealer, refetchTurnIndex]);

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
