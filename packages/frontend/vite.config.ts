import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@reown/appkit") || id.includes("@walletconnect")) {
            return "wallet";
          }

          if (id.includes("wagmi") || id.includes("viem")) {
            return "web3";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          if (id.includes("framer-motion")) {
            return "motion";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }
        },
      },
    },
  },
  define: {
    "process.env.NEXT_PUBLIC_RPC_URL": JSON.stringify(
      process.env.VITE_RPC_URL || "",
    ),
    "process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID": JSON.stringify(
      process.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id",
    ),
    "process.env.NEXT_PUBLIC_POKER_TABLE_ADDRESS": JSON.stringify(
      process.env.VITE_POKER_TABLE_ADDRESS ||
        "0x351dE4C0e273952Ba7e7F870AcCD36848f2B89Ed",
    ),
    "process.env.NEXT_PUBLIC_TOKEN_ADDRESS": JSON.stringify(
      process.env.VITE_TOKEN_ADDRESS ||
        "0x176bA8b7c207Ef2672A8002B6750eBcBA81a2b66",
    ),
    "process.env.NEXT_PUBLIC_FAUCET_URL": JSON.stringify(
      process.env.VITE_FAUCET_URL || "",
    ),
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(
      process.env.VITE_API_URL || "",
    ),
  },
});
