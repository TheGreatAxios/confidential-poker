import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";

/**
 * Custom chain definition for SKALE Base Sepolia (chain ID 324705682).
 * Not yet in viem's chain definitions, so we define it locally.
 */
export const skaleBaseSepolia = defineChain({
  id: config.chainId,
  name: "SKALE Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "SKALE Explorer",
      url: "https://base-sepolia-testnet.explorer.skale.network",
    },
  },
});

// Derive the account from the private key
const account = privateKeyToAccount(config.privateKey);

// Public client for read operations
export const publicClient = createPublicClient({
  chain: skaleBaseSepolia,
  transport: http(config.rpcUrl),
});

// Wallet client for write operations (signed by the server/dealer)
export const walletClient = createWalletClient({
  account,
  chain: skaleBaseSepolia,
  transport: http(config.rpcUrl),
});

export const dealerAddress = account.address;
