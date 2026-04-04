// Zero-server — all calls go directly wallet→contract via wagmi.
// Server API is optional; hooks gracefully fall back to demo data.

interface FaucetBalances {
  mskl?: number;
  axusd?: number;
  msklCooldown?: number;
  axusdCooldown?: number;
}

export const api = {
  // Faucet
  getFaucetBalances: async (_address: string): Promise<FaucetBalances> => {
    throw new Error("Server API not configured — use wallet directly");
  },
  claimMskl: async (_address: string): Promise<void> => {
    throw new Error("Server API not configured — use wallet directly");
  },
  claimAxusd: async (_address: string): Promise<void> => {
    throw new Error("Server API not configured — use wallet directly");
  },
  // Tips
  getTipHistory: async (): Promise<unknown[]> => {
    throw new Error("Server API not configured");
  },
  tipAgent: async (_agentId: number, _amount: number): Promise<void> => {
    throw new Error("Server API not configured");
  },
  // Game control
  startGame: async (): Promise<void> => {
    throw new Error("Use dealNewHand() via contract directly");
  },
  stopGame: async (): Promise<void> => {
    throw new Error("Not available — use leaveTable() via contract");
  },
};
