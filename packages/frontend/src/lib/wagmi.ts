// ─── Wagmi Configuration for SKALE Base Sepolia ─────────────────────────────────

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient } from '@tanstack/react-query'
import { FRONTEND_CONFIG } from '@/lib/config'

export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

const skaleBaseSepolia = {
  id: FRONTEND_CONFIG.chainId,
  name: 'SKALE Base Sepolia',
  nativeCurrency: { name: 'SKALE', symbol: 'sFUEL', decimals: 18 },
  rpcUrls: { default: { http: [FRONTEND_CONFIG.rpcUrl] } },
}

const wagmiAdapter = new WagmiAdapter({
  ssr: false,
  networks: [skaleBaseSepolia],
  projectId,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks: [skaleBaseSepolia],
  projectId,
  metadata: {
    name: 'AI Poker Night',
    description: 'Confidential Poker with AI Agents on SKALE',
    url: 'https://poker.skale.space',
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
  },
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 3_000, refetchInterval: 5_000 },
  },
})

export { wagmiAdapter }
