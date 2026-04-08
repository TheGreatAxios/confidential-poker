import { useEffect, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  POKER_TABLE_ABI,
  POKER_TABLE_ADDRESS,
  TOKEN_ADDRESS,
  ERC20_ABI,
  BUY_IN,
  isContractDeployed,
} from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
import { generateViewerKeyPair, persistViewerKey } from "@/lib/viewer-key";
import { TOKEN_DECIMALS } from "@/lib/token-format";

interface JoinPanelProps {
  onJoined?: (address: `0x${string}`) => void;
  onLeft?: () => void;
  mode?: "join" | "rejoin";
  canCashOut?: boolean;
}

type Step = "idle" | "leaving" | "approving" | "joining" | "done";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.includes("InsufficientCtxReserve")) {
      return "Table CTX reserve is too low to start a hand. Refill the contract gas reserve.";
    }
    if (error.message.toLowerCase().includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    return error.message;
  }
  return "Transaction failed.";
}

const TARGET_CHAIN_HEX = `0x${FRONTEND_CONFIG.chainId.toString(16)}`;

type InjectedProvider = {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  request?: (args: unknown) => Promise<unknown>;
};

function getInjectedProvider(): InjectedProvider | null {
  const provider = (globalThis as { ethereum?: InjectedProvider }).ethereum;
  return provider ?? null;
}

async function getInjectedChainId(): Promise<number | null> {
  const provider = getInjectedProvider();
  if (!provider?.request) return null;
  const hex = await provider.request({ method: "eth_chainId" });
  if (typeof hex !== "string") return null;
  return Number.parseInt(hex, 16);
}

async function switchChainWithProviderFallback() {
  const eth = getInjectedProvider();
  if (!eth?.request) {
    throw new Error("No injected wallet provider found.");
  }

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: TARGET_CHAIN_HEX }],
    });
    return;
  } catch (switchErr) {
    const code =
      typeof switchErr === "object" && switchErr && "code" in switchErr
        ? (switchErr as { code?: number }).code
        : undefined;

    // 4902: chain not added in wallet
    if (code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TARGET_CHAIN_HEX,
            chainName: "SKALE Base Sepolia",
            nativeCurrency: { name: "SKALE", symbol: "sFUEL", decimals: 18 },
            rpcUrls: [FRONTEND_CONFIG.rpcUrl],
            blockExplorerUrls: [FRONTEND_CONFIG.explorerUrl.replace(/\/$/, "")],
          },
        ],
      });

      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
      });
      return;
    }

    throw switchErr;
  }
}

export function JoinPanel({
  onJoined,
  onLeft,
  mode = "join",
  canCashOut = false,
}: JoinPanelProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  // Read on-chain BUY_IN and token metadata
  const { data: onChainBuyIn } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "BUY_IN",
    query: { enabled: isContractDeployed(POKER_TABLE_ADDRESS) },
  });

  const { data: tokenSymbol } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: isContractDeployed(TOKEN_ADDRESS) },
  });

  const { data: tokenDecimals } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isContractDeployed(TOKEN_ADDRESS) },
  });

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, POKER_TABLE_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Check token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const activeBuyIn = onChainBuyIn ?? BUY_IN;
  const decimals = tokenDecimals ?? TOKEN_DECIMALS;
  const symbol = tokenSymbol ?? "SKL";
  const formattedBuyIn = formatAmount(activeBuyIn, decimals);
  const needsApproval = (allowance ?? 0n) < activeBuyIn;
  const hasBalance = (balance ?? 0n) >= activeBuyIn;
  const onExpectedChain = walletChainId === FRONTEND_CONFIG.chainId;
  const hasReadData =
    onChainBuyIn !== undefined &&
    tokenSymbol !== undefined &&
    tokenDecimals !== undefined &&
    balance !== undefined;

  useEffect(() => {
    let mounted = true;
    const provider = getInjectedProvider();

    const refreshChainId = async () => {
      const id = await getInjectedChainId();
      if (mounted) setWalletChainId(id);
    };

    void refreshChainId();

    const onChainChanged = () => {
      void refreshChainId();
    };

    provider?.on?.("chainChanged", onChainChanged);
    return () => {
      mounted = false;
      provider?.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const handleSwitchChain = async () => {
    try {
      try {
        await switchChainAsync({ chainId: FRONTEND_CONFIG.chainId });
      } catch {
        await switchChainWithProviderFallback();
      }
      const actualChainId = await getInjectedChainId();
      setWalletChainId(actualChainId);
      if (actualChainId !== FRONTEND_CONFIG.chainId) {
        throw new Error("Please approve the network switch in your wallet to continue.");
      }
      setMessage(null);
    } catch (err) {
      setMessage(getErrorMessage(err));
      throw err;
    }
  };

  const handleJoinWithViewerKey = async (viewerKey: ReturnType<typeof generateViewerKeyPair>) => {
    persistViewerKey(address!, viewerKey);
    setMessage(null);

    if (needsApproval) {
      setStep("approving");
      try {
        const hash = await writeContractAsync({
          chainId: FRONTEND_CONFIG.chainId,
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
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

    setStep("joining");
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "sitDown",
        args: [{ x: viewerKey.x, y: viewerKey.y }],
      });
      setTxHash(hash);
      setMessage(mode === "rejoin" ? "Waiting for rejoin confirmation..." : "Waiting for join confirmation...");

      if (!publicClient) throw new Error("No RPC client.");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 1_000,
      });
      if (receipt.status !== "success") throw new Error("Join reverted on-chain.");
      onJoined?.(address!);
      setStep("done");
      setMessage(mode === "rejoin" ? "Viewer key restored." : "Joined table.");
    } catch (err) {
      setMessage(getErrorMessage(err));
      setStep("idle");
    }
  };

  const handleJoin = async () => {
    if (step !== "idle" || !address) return;

    if (!onExpectedChain) {
      try {
        await handleSwitchChain();
      } catch {
        return;
      }
    }

    if (!isContractDeployed(POKER_TABLE_ADDRESS)) {
      setMessage("Poker table contract is not deployed.");
      return;
    }

    if (!hasReadData) {
      setMessage("Unable to read contract state. Check network and deployed addresses.");
      return;
    }

    if (!hasBalance) {
      setMessage(`Insufficient ${symbol} balance. Need ${formattedBuyIn} ${symbol}.`);
      return;
    }

    const viewerKey = generateViewerKeyPair();
    await handleJoinWithViewerKey(viewerKey);
  };

  const handleRejoin = async () => {
    if (step !== "idle" || !address || mode !== "rejoin") return;

    if (!onExpectedChain) {
      try {
        await handleSwitchChain();
      } catch {
        return;
      }
    }

    if (!isContractDeployed(POKER_TABLE_ADDRESS)) {
      setMessage("Poker table contract is not deployed.");
      return;
    }

    setStep("leaving");
    try {
      const leaveHash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: canCashOut ? "leaveTable" : "forfeitAndLeave",
      });
      setTxHash(leaveHash);
      setMessage(canCashOut ? "Leaving table to restore viewer key..." : "Forfeiting current seat to restore viewer key...");

      if (!publicClient) throw new Error("No RPC client.");
      const leaveReceipt = await publicClient.waitForTransactionReceipt({
        hash: leaveHash,
        pollingInterval: 1_000,
      });
      if (leaveReceipt.status !== "success") {
        throw new Error("Leave reverted on-chain.");
      }

      onLeft?.();
      await refetchBalance();
      await refetchAllowance();

      const refreshedBalance = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      if (refreshedBalance < activeBuyIn) {
        setMessage(`Insufficient ${symbol} balance to rejoin. Need ${formattedBuyIn} ${symbol}.`);
        setStep("idle");
        return;
      }

      const viewerKey = generateViewerKeyPair();
      await handleJoinWithViewerKey(viewerKey);
    } catch (err) {
      setMessage(getErrorMessage(err));
      setStep("idle");
    }
  };

  const isBusy = step === "leaving" || step === "approving" || step === "joining";

  const statusLabel = (() => {
    if (step === "leaving") return canCashOut ? "Leaving..." : "Forfeiting...";
    if (step === "approving") return "Approving...";
    if (step === "joining") return mode === "rejoin" ? "Rejoining..." : "Joining...";
    if (step === "done") return mode === "rejoin" ? "Restored" : "Joined";
    if (!isConnected) return "Connect Wallet";
    return mode === "rejoin" ? "Restore Viewer Key" : "Join Table";
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
          onClick={isConnected ? (mode === "rejoin" ? handleRejoin : handleJoin) : () => openConnectModal?.()}
          disabled={isBusy || step === "done"}
          className="rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-4 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {statusLabel}
        </button>

        {txHash && (
          <a
            href={`${FRONTEND_CONFIG.explorerUrl}tx/${txHash}`}
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
        {mode === "join" ? (
          <>
            <span>
              Buy-in:{" "}
              <span className="font-semibold text-poker-gold">
                {formattedBuyIn} {symbol}
              </span>
            </span>
            {isConnected && hasReadData && !hasBalance && (
              <span className="text-poker-red">Insufficient balance</span>
            )}
            {isConnected && hasBalance && needsApproval && step === "idle" && (
              <span className="text-yellow-400">
                Approval required before joining
              </span>
            )}
          </>
        ) : (
          <span>
            Local viewer key is missing on this device. {canCashOut ? "Your stack will be returned, then a new viewer key will be registered." : "This hand will be forfeited, then a new viewer key will be registered."}
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
