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
import { formatTokenAmount } from "@/lib/token-format";

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
const GAME_STARTED_EVENT = parseAbiItem("event GameStarted(uint256 handNumber, address indexed dealer)");
const HAND_COMPLETE_EVENT = parseAbiItem("event HandComplete()");
const WINNER_EVENT = parseAbiItem("event Winner(address indexed player, uint256 amount, string handName)");

type HandResolution = {
  winnerAddresses: string[];
  winnerAmount: bigint | null;
  winnerHandName: string | null;
  handComplete: boolean;
};

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
  const [handResolution, setHandResolution] = useState<HandResolution>({
    winnerAddresses: [],
    winnerAmount: null,
    winnerHandName: null,
    handComplete: false,
  });
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
    if (!publicClient || table.handNumber === 0n) {
      setRevealedCardsByAddress({});
      setHandResolution({
        winnerAddresses: [],
        winnerAmount: null,
        winnerHandName: null,
        handComplete: false,
      });
      return;
    }

    const client = publicClient;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function loadHandEvents() {
      try {
        const latestBlock = await client.getBlockNumber();
        const searchFromBlock = latestBlock > 10_000n ? latestBlock - 10_000n : 0n;
        const gameStartedLogs = await client.getLogs({
          address: POKER_TABLE_ADDRESS,
          event: GAME_STARTED_EVENT,
          fromBlock: searchFromBlock,
          toBlock: "latest",
        });

        if (cancelled) {
          return;
        }

        const currentHandLog = [...gameStartedLogs]
          .reverse()
          .find((log) => (typeof log.args.handNumber === "bigint" ? log.args.handNumber : BigInt(log.args.handNumber ?? 0)) === table.handNumber);

        if (!currentHandLog) {
          setRevealedCardsByAddress({});
          setHandResolution({
            winnerAddresses: [],
            winnerAmount: null,
            winnerHandName: null,
            handComplete: false,
          });
          return;
        }

        const handFromBlock = currentHandLog.blockNumber ?? searchFromBlock;
        const [revealedLogs, winnerLogs, handCompleteLogs] = await Promise.all([
          client.getLogs({
            address: POKER_TABLE_ADDRESS,
            event: CARDS_REVEALED_EVENT,
            fromBlock: handFromBlock,
            toBlock: "latest",
          }),
          client.getLogs({
            address: POKER_TABLE_ADDRESS,
            event: WINNER_EVENT,
            fromBlock: handFromBlock,
            toBlock: "latest",
          }),
          client.getLogs({
            address: POKER_TABLE_ADDRESS,
            event: HAND_COMPLETE_EVENT,
            fromBlock: handFromBlock,
            toBlock: "latest",
          }),
        ]);

        if (cancelled) {
          return;
        }

        const nextCards: Record<string, Card[]> = {};
        for (const log of revealedLogs) {
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
        const winnerAddresses = Array.from(
          new Set(
            winnerLogs
              .map((log) => log.args.player?.toLowerCase())
              .filter((playerAddress): playerAddress is string => !!playerAddress),
          ),
        );
        const latestWinnerLog = winnerLogs[winnerLogs.length - 1];
        setHandResolution({
          winnerAddresses,
          winnerAmount: typeof latestWinnerLog?.args.amount === "bigint" ? latestWinnerLog.args.amount : null,
          winnerHandName: typeof latestWinnerLog?.args.handName === "string" ? latestWinnerLog.args.handName : null,
          handComplete: handCompleteLogs.length > 0 || winnerAddresses.length > 0,
        });
      } catch {
        if (cancelled) {
          return;
        }
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void loadHandEvents();
          }, 5_000);
        }
      }
    }

    void loadHandEvents();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [publicClient, table.handNumber]);

  const gameState = useMemo<GameState>(() => {
    const dealer = typeof dealerAddress === "string" ? dealerAddress.toLowerCase() : null;
    const currentTurnIndex =
      typeof turnIndexRead === "bigint" && turnIndexRead !== NO_TURN ? Number(turnIndexRead) : null;
    const isTableEmpty = table.playerCount === 0n;
    const isWaiting = table.phase === "waiting";
    const activePlayerCount = players.filter(player => player?.isActive).length;
    const handComplete =
      table.phase === "showdown" ||
      handResolution.handComplete ||
      (activePlayerCount === 1 && players.some((player) => player?.hadCardsThisHand));

    const revealablePlayers = players.flatMap((player) => {
      if (!player) {
        return [];
      }

      const revealedCards = revealedCardsByAddress[player.address.toLowerCase()] ?? [];
      return revealedCards.length === 2 ? [{ id: `agent-${player.seatIndex}`, cards: revealedCards }] : [];
    });

    const eventWinnerIds = players.flatMap((player, i) => {
      if (!player) {
        return [];
      }

      return handResolution.winnerAddresses.includes(player.address.toLowerCase()) ? [`agent-${i}`] : [];
    });

    // If only one active player remains, they are the winner by default
    const foldWinnerIds = activePlayerCount === 1 && handComplete
      ? players.flatMap((player, i) => player?.isActive ? [`agent-${i}`] : [])
      : [];

    const inferredWinnerIds =
      handComplete && revealablePlayers.length > 0 && table.phase === "showdown"
        ? findWinningPlayerIds(revealablePlayers, table.communityCards)
        : [];

    const winners = eventWinnerIds.length > 0
      ? eventWinnerIds
      : foldWinnerIds.length > 0
        ? foldWinnerIds
        : inferredWinnerIds;
    const winnerSet = new Set(winners);
    const handPlayerIndexes = players.flatMap((player, index) => (player?.hadCardsThisHand ? [index] : []));
    const orderedHandPlayerIndexes =
      dealer !== null && handPlayerIndexes.length > 0
        ? [
            ...handPlayerIndexes.filter((index) => players[index]?.address.toLowerCase() === dealer),
            ...handPlayerIndexes.filter((index) => players[index]?.address.toLowerCase() !== dealer),
          ]
        : handPlayerIndexes;
    const smallBlindIndex = orderedHandPlayerIndexes[0] ?? null;
    const bigBlindIndex = orderedHandPlayerIndexes[1] ?? null;

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

      let handOutcome: GameState["agents"][number]["handOutcome"] = null;
      const isWinner = winnerSet.has(`agent-${i}`);
      if (handComplete && player.hadCardsThisHand && status !== "busted") {
        handOutcome = isWinner ? "winner" : (!player.isActive ? "folded" : "lost");
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
          isSmallBlind: smallBlindIndex === i,
          isBigBlind: bigBlindIndex === i,
          isThinking: !handComplete && currentTurnIndex === i,
          isWinner,
          cardsRevealed: revealedCards.length === 2,
          message: null,
          seatIndex: i,
          winRate: 0,
          handsPlayed: Number(table.handNumber),
          color: COLORS[i % COLORS.length] ?? "#6b7280",
          handComplete,
          handOutcome,
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
    const winnerNames = agents.filter((agent) => agent.isWinner).map((agent) => agent.name);
    const winnerSummary =
      handComplete && winnerNames.length > 0
        ? `Winner: ${winnerNames.join(" & ")}${handResolution.winnerHandName ? ` with ${handResolution.winnerHandName}` : ""}${handResolution.winnerAmount !== null ? ` for ${formatTokenAmount(handResolution.winnerAmount)} SKL` : ""}`
        : handComplete
          ? "Hand complete."
          : null;
    const revealedShowdownPlayers = agents.filter((agent) => agent.cardsRevealed && agent.cards.length === 2).length;
    const endedBy: NonNullable<GameState["handSummary"]>["endedBy"] =
      handComplete
        ? revealedShowdownPlayers >= 2
          ? "showdown"
          : winnerNames.length > 0
            ? "folds"
            : "unknown"
        : "unknown";
    const handSummary =
      handComplete
        ? {
            headline:
              winnerNames.length > 0
                ? `${winnerNames.join(" & ")} won the hand`
                : "Hand complete",
            detail:
              endedBy === "showdown"
                ? `${handResolution.winnerHandName ? `Winning hand: ${handResolution.winnerHandName}. ` : ""}${handResolution.winnerAmount !== null ? `Payout ${formatTokenAmount(handResolution.winnerAmount)} SKL.` : "Showdown resolved."}`
                : endedBy === "folds"
                  ? `${handResolution.winnerAmount !== null ? `Payout ${formatTokenAmount(handResolution.winnerAmount)} SKL. ` : ""}All other players folded.`
                  : "Waiting for result events to finalize details.",
            winnerNames,
            endedBy,
          }
        : null;

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
      lastAction: winnerSummary,
      handSummary,
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
    handResolution,
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
