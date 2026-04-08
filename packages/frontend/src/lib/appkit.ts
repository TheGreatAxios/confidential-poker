import { FRONTEND_CONFIG } from "@/lib/config";
import { wagmiAdapter, projectId, skaleBaseSepolia } from "@/providers";

let initialized = false;

export async function ensureAppKit() {
  if (initialized) {
    return;
  }

  const { createAppKit } = await import("@reown/appkit/react");

  createAppKit({
    adapters: [wagmiAdapter],
    networks: [skaleBaseSepolia],
    projectId,
    metadata: {
      name: "Texas Hold'em on SKALE",
      description:
        "Poker onchain for humans and agents - Powered by SKALE's Programmable Privacy",
      url: import.meta.env.DEV
        ? "http://localhost:5173"
        : "https://poker.skale.space",
      icons: ["https://avatars.githubusercontent.com/u/37784886"],
    },
  });

  initialized = true;
}
