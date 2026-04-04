/**
 * ABI for PokerGame — the core on-chain poker contract.
 *
 * Key design: cards are dealt on-chain via revealCardsManually (plaintext for hackathon speed).
 * Production would use BITE CTX for encrypted card dealing.
 * Betting actions are plaintext on-chain for speed.
 */
export const pokerGameAbi = [
  // ── Table Management ──
  {
    inputs: [
      { name: "minBuyIn", type: "uint256" },
      { name: "maxPlayers", type: "uint256" },
      { name: "smallBlind", type: "uint256" },
      { name: "bigBlind", type: "uint256" },
    ],
    name: "createTable",
    outputs: [{ name: "tableId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "tableId", type: "uint256" },
      { name: "commitmentHash", type: "bytes32" },
      { name: "buyInAmount", type: "uint256" },
    ],
    name: "joinTable",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Hand Lifecycle ──
  {
    inputs: [{ name: "tableId", type: "uint256" }],
    name: "startHandNoCTX",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tableId", type: "uint256" }],
    name: "revealCardsManually",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Player Actions ──
  {
    inputs: [
      { name: "tableId", type: "uint256" },
      { name: "actionType", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    name: "submitAction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── View Functions ──
  {
    inputs: [{ name: "tableId", type: "uint256" }],
    name: "getGameState",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "phase", type: "uint8" },
          { name: "pot", type: "uint256" },
          { name: "currentBet", type: "uint256" },
          { name: "dealerIndex", type: "uint256" },
          { name: "currentPlayerIndex", type: "uint256" },
          { name: "communityCards", type: "uint256[]" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "tableId", type: "uint256" },
      { name: "playerIndex", type: "uint256" },
    ],
    name: "getPlayerInfo",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "player", type: "address" },
          { name: "balance", type: "uint256" },
          { name: "currentBet", type: "uint256" },
          { name: "isFolded", type: "bool" },
          { name: "isAllIn", type: "bool" },
          { name: "card1", type: "uint256" },
          { name: "card2", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tableId", type: "uint256" }],
    name: "getPlayerCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tableId", type: "uint256" }],
    name: "getActivePlayerCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tableId", type: "uint256" }],
    name: "getCommunityCards",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "tableId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    name: "forcePayout",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
