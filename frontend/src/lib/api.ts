// Zero-server — all calls go directly wallet→contract via wagmi.
// Server API is optional; hooks gracefully fall back to demo data.

export const api = {
  // Faucet
  getFaucetBalances: async (_address: string) => {
    throw new Error("Server API not configured — use wallet directly");
  },
  claimMskl: async (_address: string) => {
    throw new Error("Server API not configured — use wallet directly");
  },
  claimAxusd: async (_address: string) => {
    throw new Error("Server API not configured — use wallet directly");
  },
  // Tips
  getTipHistory: async () => {
    throw new Error("Server API not configured");
  },
  tipAgent: async (_agentId: number, _amount: number) => {
    throw new Error("Server API not configured");
  },
  // Game control
  startGame: async () => {
    throw new Error("Use dealNewHand() via contract directly");
  },
  stopGame: async () => {
    throw new Error("Not available — use leaveTable() via contract");
  },
} as const;
