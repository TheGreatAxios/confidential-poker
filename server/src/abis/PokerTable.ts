// ============================================================
// Contract ABIs — PokerTable + FaucetDrip (server copy)
// Matches frontend/src/lib/abis.ts exactly
// ============================================================

// ---------- PokerTable ----------

const PLAYER_STRUCT = {
  components: [
    { name: "addr", type: "address" },
    { name: "viewerKey", type: "bytes32" },
    { name: "stack", type: "uint256" },
    { name: "currentBet", type: "uint256" },
    { name: "folded", type: "bool" },
    { name: "hasActed", type: "bool" },
    { name: "isSeated", type: "bool" },
    { name: "holeCards", type: "uint8[2]" },
  ],
} as const;

export const pokerTableAbi = [
  // ---- Public state variable getters ----
  { type: "function", name: "phase", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "pot", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "currentMaxBet", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "handCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "dealerIndex", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "activePlayerIndex", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "communityCardCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "lastRaise", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "smallBlind", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "bigBlind", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "minBuyIn", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "maxPlayers", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "lastActionTimestamp", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "ACTION_TIMEOUT", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "communityCards", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "hasEverPlayed", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },

  // ---- Array accessors ----
  { type: "function", name: "players", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [
    { name: "addr", type: "address" },
    { name: "viewerKey", type: "bytes32" },
    { name: "stack", type: "uint256" },
    { name: "currentBet", type: "uint256" },
    { name: "folded", type: "bool" },
    { name: "hasActed", type: "bool" },
    { name: "isSeated", type: "bool" },
    { name: "holeCards", type: "uint8[2]" },
  ]},

  // ---- View functions ----
  { type: "function", name: "getSeatedPlayerCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getActivePlayerCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getPlayers", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "tuple[]", components: PLAYER_STRUCT.components }] },
  { type: "function", name: "getCommunityCards", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8[]" }] },
  { type: "function", name: "getActivePlayer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "getDealer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "isPlayerSeated", stateMutability: "view", inputs: [{ name: "who", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "isPlayerFolded", stateMutability: "view", inputs: [{ name: "who", type: "address" }], outputs: [{ name: "", type: "bool" }] },

  // ---- Write functions ----
  { type: "function", name: "sitDown", stateMutability: "payable", inputs: [{ name: "viewerKey", type: "bytes32" }], outputs: [] },
  { type: "function", name: "leaveTable", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "dealNewHand", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "fold", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "check", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "call", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "raise", stateMutability: "nonpayable", inputs: [{ name: "raiseAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "revealCards", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "resolveHand", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "forceFold", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "emergencyWithdraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "transferOwnership", stateMutability: "nonpayable", inputs: [{ name: "newOwner", type: "address" }], outputs: [] },

  // ---- Events ----
  { type: "event", name: "PlayerSatDown", inputs: [
    { name: "player", type: "address", indexed: true },
    { name: "buyIn", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "PlayerLeft", inputs: [
    { name: "player", type: "address", indexed: true },
    { name: "cashout", type: "uint256", indexed: false },
    { name: "fee", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "HandStarted", inputs: [
    { name: "handNumber", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "CardsDealt", inputs: [
    { name: "player", type: "address", indexed: true },
  ]},
  { type: "event", name: "PhaseAdvanced", inputs: [
    { name: "newPhase", type: "uint8", indexed: false },
  ]},
  { type: "event", name: "PlayerFolded", inputs: [
    { name: "player", type: "address", indexed: true },
  ]},
  { type: "event", name: "PlayerChecked", inputs: [
    { name: "player", type: "address", indexed: true },
  ]},
  { type: "event", name: "PlayerCalled", inputs: [
    { name: "player", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "PlayerRaised", inputs: [
    { name: "player", type: "address", indexed: true },
    { name: "totalBet", type: "uint256", indexed: false },
    { name: "raiseAmount", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "ShowdownComplete", inputs: [
    { name: "winner", type: "address", indexed: true },
    { name: "pot", type: "uint256", indexed: false },
    { name: "winningHand", type: "string", indexed: false },
    { name: "winningScore", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "HandFinished", inputs: [
    { name: "handNumber", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "ReceivedEth", inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "CommunityCardDealt", inputs: [
    { name: "card", type: "uint8", indexed: false },
    { name: "index", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "PlayerTimedOut", inputs: [
    { name: "player", type: "address", indexed: true },
  ]},
  { type: "event", name: "PotUnclaimed", inputs: [
    { name: "amount", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "EmergencyWithdraw", inputs: [
    { name: "to", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ]},
  { type: "event", name: "OwnershipTransferred", inputs: [
    { name: "previousOwner", type: "address", indexed: true },
    { name: "newOwner", type: "address", indexed: true },
  ]},
  { type: "event", name: "SplitPot", inputs: [
    { name: "winners", type: "address[]", indexed: false },
    { name: "share", type: "uint256", indexed: false },
    { name: "winningHand", type: "string", indexed: false },
    { name: "winningScore", type: "uint256", indexed: false },
  ]},
] as const;

// ---------- FaucetDrip ----------

export const faucetAbi = [
  {
    type: "function",
    name: "drip",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "lastClaim",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "timeUntilDrip",
    stateMutability: "view",
    inputs: [{ name: "_addr", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "DRIP_AMOUNT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "COOLDOWN",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Dripped",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FaucetFunded",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
