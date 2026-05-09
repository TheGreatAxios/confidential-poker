import type { Address, PublicClient } from "viem";
import { POKER_GAME_ABI } from "../abis/poker-game";

export interface GameEvents {
  onTurnChanged?: (playerIndex: bigint, player: Address) => void;
  onPhaseChanged?: (newPhase: number, handNumber: bigint) => void;
  onHandComplete?: () => void;
  onPlayerAction?: (player: Address, action: string, amount: bigint) => void;
  onShowdown?: (activeCount: bigint) => void;
  onPotAwarded?: (player: Address, amount: bigint) => void;
}

export function startEventWatcher(
  publicClient: PublicClient,
  tableAddress: Address,
  events: GameEvents,
) {
  const unwatchHandlers: Array<() => void> = [];

  if (events.onTurnChanged) {
    const unwatch = publicClient.watchContractEvent({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      eventName: "TurnChanged",
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args) {
            events.onTurnChanged!(
              log.args.playerIndex as bigint,
              log.args.player as Address,
            );
          }
        }
      },
      strict: true,
    });
    unwatchHandlers.push(unwatch);
  }

  if (events.onPhaseChanged) {
    const unwatch = publicClient.watchContractEvent({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      eventName: "PhaseChanged",
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args) {
            events.onPhaseChanged!(
              log.args.newPhase as number,
              log.args.handNumber as bigint,
            );
          }
        }
      },
      strict: true,
    });
    unwatchHandlers.push(unwatch);
  }

  if (events.onHandComplete) {
    const unwatch = publicClient.watchContractEvent({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      eventName: "HandComplete",
      onLogs: () => {
        events.onHandComplete!();
      },
      strict: true,
    });
    unwatchHandlers.push(unwatch);
  }

  if (events.onPlayerAction) {
    const unwatch = publicClient.watchContractEvent({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      eventName: "PlayerAction",
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args) {
            events.onPlayerAction!(
              log.args.player as Address,
              log.args.action as string,
              log.args.amount as bigint,
            );
          }
        }
      },
      strict: true,
    });
    unwatchHandlers.push(unwatch);
  }

  if (events.onShowdown) {
    const unwatch = publicClient.watchContractEvent({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      eventName: "ShowdownInitiated",
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args) {
            events.onShowdown!(log.args.activePlayerCount as bigint);
          }
        }
      },
      strict: true,
    });
    unwatchHandlers.push(unwatch);
  }

  if (events.onPotAwarded) {
    const unwatch = publicClient.watchContractEvent({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      eventName: "PotAwarded",
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args) {
            events.onPotAwarded!(
              log.args.player as Address,
              log.args.amount as bigint,
            );
          }
        }
      },
      strict: true,
    });
    unwatchHandlers.push(unwatch);
  }

  return () => {
    for (const unwatch of unwatchHandlers) {
      unwatch();
    }
  };
}

export function watchTurnChanged(
  publicClient: PublicClient,
  tableAddress: Address,
  ourAddress: Address,
  callback: (isMyTurn: boolean) => void,
) {
  return publicClient.watchContractEvent({
    address: tableAddress,
    abi: POKER_GAME_ABI,
    eventName: "TurnChanged",
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args) {
          callback(
            (log.args.player as Address).toLowerCase() === ourAddress.toLowerCase(),
          );
        }
      }
    },
    strict: true,
  });
}
