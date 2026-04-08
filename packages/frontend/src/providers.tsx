// ─── Reown AppKit + Wagmi Provider Setup ─────────────────────────────────

import { ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { createAppKit, AppKitProvider } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { FRONTEND_CONFIG } from '@/lib/config'
import type { AppKitNetwork } from '@reown/appkit-common'
import type { CreateAppKit } from '@reown/appkit/react'

export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

const skaleBaseSepolia: AppKitNetwork = {
  id: FRONTEND_CONFIG.chainId,
  name: 'SKALE Base Sepolia',
  nativeCurrency: { name: 'CREDITS', symbol: 'CREDITS', decimals: 18 },
  rpcUrls: { default: { http: [FRONTEND_CONFIG.rpcUrl] } },
}

const networks: [AppKitNetwork] = [skaleBaseSepolia]

const wagmiAdapter = new WagmiAdapter({
  ssr: false,
  networks,
  projectId,
})

const isDev = import.meta.env.DEV
const appKitConfig: CreateAppKit = {
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Texas Hold\'em on SKALE',
    description: 'Poker onchain for humans and agents - Powered by SKALE\'s Programmable Privacy',
    url: isDev ? 'http://localhost:5173' : 'https://poker.skale.space',
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
  },
}

createAppKit(appKitConfig)

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3_000,
            refetchInterval: 5_000,
          },
        },
      }),
  )

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppKitProvider {...appKitConfig}>{children}</AppKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export async function addSKALEChain() {
  if (typeof window === 'undefined') return

  const eth = (window as any).ethereum
  if (!eth) return

  const chainId = '0x' + FRONTEND_CONFIG.chainId.toString(16)

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    })
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId,
            chainName: 'SKALE Base Sepolia',
            nativeCurrency: { name: 'CREDITS', symbol: 'CREDITS', decimals: 18 },
            rpcUrls: [FRONTEND_CONFIG.rpcUrl],
            blockExplorerUrls: [FRONTEND_CONFIG.explorerUrl],
          }],
        })
      } catch (addError) {
        console.error('Failed to add chain:', addError)
      }
    }
  }
}
