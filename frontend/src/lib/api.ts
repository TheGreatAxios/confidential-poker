const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    } catch (err) {
      // Silently fail for demo mode — server might not be running
      console.warn(`API call failed: ${path}`, err);
      throw err;
    }
  }

  // Game
  async getGame(id: string = "current") {
    return this.request<any>(`/api/game/${id}`);
  }

  // Faucet
  async claimMskl(address: string) {
    return this.request<any>("/api/faucet/mskl", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  }

  async claimAxusd(address: string) {
    return this.request<any>("/api/faucet/axusd", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  }

  async getFaucetBalances(address: string) {
    return this.request<any>(`/api/faucet/balances?address=${address}`);
  }

  // Tips
  async tipAgent(agentId: number, amount: number = 0.05) {
    return this.request<any>("/api/tip", {
      method: "POST",
      body: JSON.stringify({ agentId, amount }),
    });
  }

  async getTipHistory() {
    return this.request<any>("/api/tip/history");
  }
}

export const api = new ApiClient(API_BASE);
