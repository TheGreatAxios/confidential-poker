// ─── Contract ABI & Address for the Poker Table ─────────────────────────────────
//
// Duplicated from the server's abis.ts so the frontend package stays independent.
// The ABI defines the public interface of the on-chain poker contract.

export const POKER_TABLE_ADDRESS = (process.env
  .NEXT_PUBLIC_POKER_TABLE_ADDRESS ??
  "0x81Ee21F192D85d04cbE37eB303629B68f5a92258") as `0x${string}`;

export const TOKEN_ADDRESS = (process.env
  .NEXT_PUBLIC_TOKEN_ADDRESS ??
  "0xa73dDa16E180Ed08FC532CCf5Dc258890D6b2FdF") as `0x${string}`;

/** 1000 tokens with 6 decimals — must match contract BUY_IN constant */
export const BUY_IN = 1_000_000_000n;

export const POKER_TABLE_ABI = [
  // ── Player Actions (all public) ───────────────────────────────────────────
  {
    type: "function" as const,
    name: "sitDown",
    inputs: [
      {
        name: "viewerKey",
        type: "tuple",
        components: [
          { name: "x", type: "bytes32" },
          { name: "y", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "fold",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "check",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "call",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function" as const,
    name: "raise",
    inputs: [{ name: "raiseAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function" as const,
    name: "revealCards",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },

  // ── Game Flow (dealer-controlled) ─────────────────────────────────────────
  {
    type: "function" as const,
    name: "dealNewHand",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "dealFlop",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "dealTurn",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "dealRiver",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "resolveHand",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ── Read Functions ────────────────────────────────────────────────────────
  {
    type: "function" as const,
    name: "phase",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "pot",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "playerCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "getPlayer",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "getCommunityCards",
    inputs: [],
    outputs: [{ name: "", type: "uint8[5]" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "activePlayerCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "getEncryptedCards",
    inputs: [{ name: "playerIndex", type: "uint256" }],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "getMyEncryptedCards",
    inputs: [],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "getMyHoleCards",
    inputs: [],
    outputs: [
      { name: "card1", type: "uint8" },
      { name: "card2", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "areMyCardsRevealed",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "isCardsRevealed",
    inputs: [{ name: "playerIndex", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "getPhaseName",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "evaluatePlayerHand",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "handRank", type: "uint8" },
      { name: "primary", type: "uint8" },
      { name: "secondary", type: "uint8" },
      { name: "tertiary", type: "uint8" },
      { name: "quaternary", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "currentBet",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "dealer",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "handNumber",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "sklToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "BUY_IN",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event" as const,
    name: "PlayerJoined",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "seat", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "GameStarted",
    inputs: [
      { name: "handNumber", type: "uint256", indexed: false },
      { name: "dealer", type: "address", indexed: true },
    ],
  },
  {
    type: "event" as const,
    name: "PlayerFolded",
    inputs: [{ name: "player", type: "address", indexed: true }],
  },
  {
    type: "event" as const,
    name: "PlayerChecked",
    inputs: [{ name: "player", type: "address", indexed: true }],
  },
  {
    type: "event" as const,
    name: "PlayerCalled",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "PlayerRaised",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "totalBet", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "FlopDealt",
    inputs: [
      { name: "card1", type: "uint8", indexed: false },
      { name: "card2", type: "uint8", indexed: false },
      { name: "card3", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "TurnDealt",
    inputs: [{ name: "card", type: "uint8", indexed: false }],
  },
  {
    type: "event" as const,
    name: "RiverDealt",
    inputs: [{ name: "card", type: "uint8", indexed: false }],
  },
  {
    type: "event" as const,
    name: "ShowdownInitiated",
    inputs: [{ name: "activePlayerCount", type: "uint256", indexed: false }],
  },
  {
    type: "event" as const,
    name: "CardsRevealed",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "card1", type: "uint8", indexed: false },
      { name: "card2", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "Winner",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "handName", type: "string", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "PotAwarded",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event" as const,
    name: "PhaseChanged",
    inputs: [{ name: "newPhase", type: "uint8", indexed: false }],
  },
  {
    type: "event" as const,
    name: "HandComplete",
    inputs: [],
  },

  // ── ERC-20 (used for approve / allowance) ─────────────────────────────────
  {
    type: "function" as const,
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function" as const,
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function" as const,
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

/** Check if a contract address is the zero address (not deployed) */
export function isContractDeployed(address: string): boolean {
  return (
    address !== "0x0000000000000000000000000000000000000000" &&
    address.length === 42
  );
}
