
import { useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  POKER_TABLE_ABI,
  POKER_TABLE_ADDRESS,
  TOKEN_ADDRESS,
  BUY_IN,
  isContractDeployed,
} from "@/lib/contracts";
import { generateViewerKeyPair, persistViewerKey } from "@/lib/viewer-key";

interface JoinPanelProps {
  onJoined?: (address: `0x${string}`) => void;
}

type Step = "idle" | "approving" | "joining" | "done";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    return error.message;
  }
  return "Transaction failed.";
}

export function JoinPanel({ onJoined }: JoinPanelProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // Read on-chain BUY_IN and token metadata
  const { data: onChainBuyIn } = useReadContract({
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "BUY_IN",
    query: { enabled: isContractDeployed(POKER_TABLE_ADDRESS) },
  });

  const { data: tokenSymbol } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "symbol",
    query: { enabled: isContractDeployed(TOKEN_ADDRESS) },
  });

  const { data: tokenDecimals } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "decimals",
    query: { enabled: isContractDeployed(TOKEN_ADDRESS) },
  });

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "allowance",
    args: address ? [address, POKER_TABLE_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Check token balance
  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const activeBuyIn = onChainBuyIn ?? BUY_IN;
  const decimals = tokenDecimals ?? 6;
  const symbol = tokenSymbol ?? "SKL";
  const formattedBuyIn = formatAmount(activeBuyIn, decimals);
  const needsApproval = (allowance ?? 0n) < activeBuyIn;
  const hasBalance = (balance ?? 0n) >= activeBuyIn;

  const handleJoin = async () => {
    if (step !== "idle" || !address) return;

    if (!isContractDeployed(POKER_TABLE_ADDRESS)) {
      setMessage("Poker table contract is not deployed.");
      return;
    }

    if (!hasBalance) {
      setMessage(`Insufficient ${symbol} balance. Need ${formattedBuyIn} ${symbol}.`);
      return;
    }

    const viewerKey = generateViewerKeyPair();
    persistViewerKey(address, viewerKey);
    setMessage(null);

    // Step 1: Approve if needed
    if (needsApproval) {
      setStep("approving");
      try {
        const hash = await writeContractAsync({
          address: TOKEN_ADDRESS,
          abi: POKER_TABLE_ABI,
          functionName: "approve",
          args: [POKER_TABLE_ADDRESS, activeBuyIn],
        });
        setTxHash(hash);
        setMessage("Waiting for approval confirmation...");

        if (!publicClient) throw new Error("No RPC client.");
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          pollingInterval: 1_000,
        });
        if (receipt.status !== "success") throw new Error("Approval reverted.");
        await refetchAllowance();
        setMessage(null);
      } catch (err) {
        setMessage(getErrorMessage(err));
        setStep("idle");
        return;
      }
    }

    // Step 2: sitDown
    setStep("joining");
    try {
      const hash = await writeContractAsync({
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "sitDown",
        args: [{ x: viewerKey.x, y: viewerKey.y }],
      });
      setTxHash(hash);
      setMessage("Waiting for join confirmation...");

      if (!publicClient) throw new Error("No RPC client.");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 1_000,
      });
      if (receipt.status !== "success") throw new Error("Join reverted on-chain.");
      onJoined?.(address);
      setStep("done");
      setMessage("Joined table.");
    } catch (err) {
      setMessage(getErrorMessage(err));
      setStep("idle");
    }
  };

  const isBusy = step === "approving" || step === "joining";

  const statusLabel = (() => {
    if (step === "approving") return "Approving...";
    if (step === "joining") return "Joining...";
    if (step === "done") return "Joined";
    if (!isConnected) return "Connect Wallet";
    return "Join Table";
  })();

  return (
    <div className="w-full max-w-3xl">
      <div className="flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-poker-text-muted">
          {address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : "Connect wallet to join"}
        </div>

        <button
          onClick={isConnected ? handleJoin : () => openConnectModal?.()}
          disabled={isBusy || step === "done"}
          className="rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-4 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {statusLabel}
        </button>

        {txHash && (
          <a
            href={`https://base-sepolia-testnet-explorer.skalenodes.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/10 px-3 py-2 text-center text-xs text-poker-text-muted transition-colors hover:text-white"
          >
            View tx
          </a>
        )}
      </div>

      {/* Buy-in info */}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 sm:text-left">
        <span>
          Buy-in:{" "}
          <span className="font-semibold text-poker-gold">
            {formattedBuyIn} {symbol}
          </span>
        </span>
        {isConnected && !hasBalance && (
          <span className="text-poker-red">Insufficient balance</span>
        )}
        {isConnected && hasBalance && needsApproval && step === "idle" && (
          <span className="text-yellow-400">
            Approval required before joining
          </span>
        )}
      </div>

      {message && (
        <p className="mt-1 text-center text-xs text-gray-400 sm:text-left">
          {message}
        </p>
      )}
    </div>
  );
}

function formatAmount(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(Number(decimals), "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}
