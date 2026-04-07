// ─── Contract ABIs & Calldata Encoding ────────────────────────────────────────

import { encodeFunctionData, encodeAbiParameters } from 'viem';
import type { Address } from 'viem';

/**
 * ABIs for the on-chain poker contracts.
 *
 * PRIVACY MODEL:
 *   - Hole cards are PRIVATE (BITE encrypted) — only the player can see them
 *   - All actions (fold, check, call, raise) are PUBLIC on-chain
 *   - Joining/leaving is PUBLIC
 *
 * The contract exposes simple, human-readable functions:
 *   sitDown(viewerKey), fold(), check(), call(), raise(amount)
 */

export const POKER_TABLE_ABI = [
  // ── Player Actions (all public — everyone sees these) ──────────────────
  {
    type: 'function',
    name: 'sitDown',
    inputs: [
      {
        name: 'viewerKey',
        type: 'tuple',
        components: [
          { name: 'x', type: 'bytes32' },
          { name: 'y', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fold',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'check',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'call',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'raise',
    inputs: [{ name: 'raiseAmount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Game Flow (dealer-controlled) ──────────────────────────────────────
  {
    type: 'function',
    name: 'dealNewHand',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'dealFlop',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'dealTurn',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'dealRiver',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveHand',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Read Functions ─────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'phase',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pot',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'playerCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPlayer',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCommunityCards',
    inputs: [],
    outputs: [{ name: '', type: 'uint8[5]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activePlayerCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEncryptedCards',
    inputs: [{ name: 'playerIndex', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMyEncryptedCards',
    inputs: [],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMyHoleCards',
    inputs: [],
    outputs: [
      { name: 'card1', type: 'uint8' },
      { name: 'card2', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'areMyCardsRevealed',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isCardsRevealed',
    inputs: [{ name: 'playerIndex', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPhaseName',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'evaluatePlayerHand',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'handRank', type: 'uint8' },
      { name: 'primary', type: 'uint8' },
      { name: 'secondary', type: 'uint8' },
      { name: 'tertiary', type: 'uint8' },
      { name: 'quaternary', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentBet',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'dealer',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'handNumber',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ── Events ─────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'PlayerJoined',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'seat', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameStarted',
    inputs: [
      { name: 'handNumber', type: 'uint256', indexed: false },
      { name: 'dealer', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PlayerFolded',
    inputs: [{ name: 'player', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'PlayerChecked',
    inputs: [{ name: 'player', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'PlayerCalled',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PlayerRaised',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'totalBet', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FlopDealt',
    inputs: [
      { name: 'card1', type: 'uint8', indexed: false },
      { name: 'card2', type: 'uint8', indexed: false },
      { name: 'card3', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TurnDealt',
    inputs: [{ name: 'card', type: 'uint8', indexed: false }],
  },
  {
    type: 'event',
    name: 'RiverDealt',
    inputs: [{ name: 'card', type: 'uint8', indexed: false }],
  },
  {
    type: 'event',
    name: 'ShowdownInitiated',
    inputs: [{ name: 'activePlayerCount', type: 'uint256', indexed: false }],
  },
  {
    type: 'event',
    name: 'CardsRevealed',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'card1', type: 'uint8', indexed: false },
      { name: 'card2', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Winner',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'handName', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PotAwarded',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PhaseChanged',
    inputs: [{ name: 'newPhase', type: 'uint8', indexed: false }],
  },
  {
    type: 'event',
    name: 'HandComplete',
    inputs: [],
  },
] as const;

export const TIP_JAR_ABI = [
  {
    type: 'function',
    name: 'tip',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'message', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getTipTotal',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: 'total', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'TipSent',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'message', type: 'string', indexed: false },
    ],
  },
] as const;

/** Contract addresses (placeholder — set via env vars in production) */
export const CONTRACT_ADDRESSES = {
  pokerTable: (process.env.POKER_TABLE_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
  tipJar: (process.env.TIP_JAR_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
} as const;

// ── Calldata Encoding Helpers ─────────────────────────────────────────────────

/** Result of encoding a contract call */
export interface EncodedCall {
  to: Address;
  data: `0x${string}`;
}

/**
 * Encode a sitDown(viewerKey) call on the poker table contract.
 */
export function encodeSitDown(viewerKey: { x: `0x${string}`; y: `0x${string}` }): EncodedCall {
  return {
    to: CONTRACT_ADDRESSES.pokerTable,
    data: encodeFunctionData({
      abi: POKER_TABLE_ABI,
      functionName: 'sitDown',
      args: [viewerKey],
    }),
  };
}

/**
 * Encode a fold() call on the poker table contract.
 */
export function encodeFold(): EncodedCall {
  return {
    to: CONTRACT_ADDRESSES.pokerTable,
    data: encodeFunctionData({
      abi: POKER_TABLE_ABI,
      functionName: 'fold',
      args: [],
    }),
  };
}

/**
 * Encode a check() call on the poker table contract.
 */
export function encodeCheck(): EncodedCall {
  return {
    to: CONTRACT_ADDRESSES.pokerTable,
    data: encodeFunctionData({
      abi: POKER_TABLE_ABI,
      functionName: 'check',
      args: [],
    }),
  };
}

/**
 * Encode a call() (payable) on the poker table contract.
 */
export function encodeCall(): EncodedCall {
  return {
    to: CONTRACT_ADDRESSES.pokerTable,
    data: encodeFunctionData({
      abi: POKER_TABLE_ABI,
      functionName: 'call',
      args: [],
    }),
  };
}

/**
 * Encode a raise(raiseAmount) call on the poker table contract.
 */
export function encodeRaise(amount: bigint): EncodedCall {
  return {
    to: CONTRACT_ADDRESSES.pokerTable,
    data: encodeFunctionData({
      abi: POKER_TABLE_ABI,
      functionName: 'raise',
      args: [amount],
    }),
  };
}

/**
 * Encode a tip(to, message) call on the tip jar contract.
 */
export function encodeTip(to: Address, message: string): EncodedCall {
  return {
    to: CONTRACT_ADDRESSES.tipJar,
    data: encodeFunctionData({
      abi: TIP_JAR_ABI,
      functionName: 'tip',
      args: [to, message],
    }),
  };
}

/**
 * Encode a generic poker game action.
 * Maps human-readable actions to the appropriate contract call.
 */
export function encodeGameAction(
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in',
  amount?: number,
): EncodedCall | null {
  switch (action) {
    case 'fold':
      return encodeFold();
    case 'check':
      return encodeCheck();
    case 'call':
      return encodeCall();
    case 'raise':
      return encodeRaise(BigInt(amount ?? 0));
    case 'all-in':
      return encodeRaise(BigInt(amount ?? 0));
    default:
      return null;
  }
}
