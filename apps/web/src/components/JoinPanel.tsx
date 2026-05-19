"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useReadContract,
} from "wagmi";
import {
  POKER_GAME_ABI,
  MOCK_SKL_ABI,
} from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
import { isContractDeployed } from "@/lib/contracts";
import { addSKALEChain } from "@/providers";
import { generateViewerKeyPair, loadViewerKey, persistViewerKey } from "@/lib/viewer-key";
import { useChipToken } from "@/hooks/useChipToken";
import { WalletConnectButton } from "./wallet-connect-button";
import { Identicon } from "./ui/identicon";
import type { TableInfo } from "@/lib/types";
import { formatTokenDisplay } from "@/lib/token-format";

type Step = "idle" | "claiming-faucet" | "approving-underlying" | "depositing" | "approving-game" | "joining" | "done";

interface JoinPanelProps {
  tableAddress: `0x${string}`;
  chipTokenAddress: `0x${string}` | null;
  tableInfo?: TableInfo | null;
  onJoined?: (joinedAddress: `0x${string}`) => void;
  onLeft?: () => void;
  mode?: "join" | "rejoin";
  canCashOut?: boolean;
}

export function JoinPanel({
  tableAddress,
  chipTokenAddress,
  tableInfo,
  onJoined,
  onLeft: _onLeft,
  mode = "join",
  canCashOut: _canCashOut = false,
}: JoinPanelProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const chipToken = useChipToken({
    chipTokenAddress: chipTokenAddress ?? FRONTEND_CONFIG.chipTokenAddress,
    gameAddress: tableAddress,
  });

  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { data: tablePhaseRaw } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "phase",
    query: { enabled: isContractDeployed(tableAddress), refetchInterval: 5_000 },
  });

  const { data: contractBuyIn } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "BUY_IN",
    query: { enabled: isContractDeployed(tableAddress), refetchInterval: 30_000 },
  });

  const { data: playerCountRaw } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "playerCount",
    query: { enabled: isContractDeployed(tableAddress), refetchInterval: 5_000 },
  });

  const { data: maxPlayersRaw } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "MAX_PLAYERS",
    query: { enabled: isContractDeployed(tableAddress), refetchInterval: 30_000 },
  });

  const tablePhase = typeof tablePhaseRaw === "number" ? tablePhaseRaw : null;
  const configBuyIn = tableInfo?.buyIn ?? 1_000_000_000_000_000_000_000n;
  const activeBuyIn = typeof contractBuyIn === "bigint" ? contractBuyIn : configBuyIn;
  const playerCount = typeof playerCountRaw === "bigint" ? Number(playerCountRaw) : null;
  const maxPlayers = typeof maxPlayersRaw === "bigint" ? Number(maxPlayersRaw) : 6;

  const hasUnderlyingBalance = chipToken.underlyingBalance >= activeBuyIn;
  const hasChipBalance = chipToken.chipBalance >= activeBuyIn;
  const needsDepositApproval = chipToken.depositAllowance < activeBuyIn;
  const needsGameApproval = chipToken.gameAllowance < activeBuyIn;

  const handleJoin = async () => {
    await addSKALEChain();

    if (!isContractDeployed(tableAddress)) {
      setMessage("Poker table contract is not deployed.");
      return;
    }

    if (!isContractDeployed(chipTokenAddress ?? FRONTEND_CONFIG.chipTokenAddress)) {
      setMessage("Chip token address is not configured.");
      return;
    }

    if (!address) {
      setMessage("Connect wallet to join.");
      return;
    }

    const viewerKey = loadViewerKey(address) ?? generateViewerKeyPair();
    persistViewerKey(address, viewerKey);

    try {
      if (mode === "rejoin") {
        if (!publicClient) throw new Error("No RPC client.");

        setStep("joining");
        setMessage("Restoring viewer key...");

        // Pre-simulate to catch revert reason early
        try {
          await publicClient.simulateContract({
            address: tableAddress,
            abi: POKER_GAME_ABI,
            functionName: "updateViewerKey",
            args: [{ x: viewerKey.x, y: viewerKey.y }],
            account: address,
          });
        } catch (simErr) {
          const reason = simErr instanceof Error ? simErr.message : String(simErr);
          if (reason.includes("NotAPlayer") || reason.includes("0xabca3517")) {
            throw new Error("You are not seated at this table. Join instead of restoring.");
          }
          throw new Error(`Cannot restore viewer key: ${reason}`);
        }

        const updateHash = await writeContractAsync({
          chainId: FRONTEND_CONFIG.chainId,
          address: tableAddress,
          abi: POKER_GAME_ABI,
          functionName: "updateViewerKey",
          args: [{ x: viewerKey.x, y: viewerKey.y }],
        });
        setTxHash(updateHash);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: updateHash,
          pollingInterval: 1_000,
        });
        if (receipt.status !== "success") {
          throw new Error("Update reverted on-chain.");
        }

        setStep("done");
        onJoined?.(address);
        return;
      }

      // New join: no longer blocked by active hand — sitDown now works in any phase

      if (!hasChipBalance) {
        if (!hasUnderlyingBalance) {
          setStep("claiming-faucet");
          setMessage("Claiming MockSKL...");
          const faucetHash = await writeContractAsync({
            chainId: FRONTEND_CONFIG.chainId,
            address: FRONTEND_CONFIG.underlyingTokenAddress,
            abi: MOCK_SKL_ABI,
            functionName: "faucet",
            args: [],
          });
          setTxHash(faucetHash);

          if (!publicClient) throw new Error("No RPC client.");
          const faucetReceipt = await publicClient.waitForTransactionReceipt({
            hash: faucetHash,
            pollingInterval: 1_000,
          });
          if (faucetReceipt.status !== "success") {
            throw new Error("Faucet claim reverted — may be on cooldown.");
          }

          await chipToken.refetch();
        }

        if (needsDepositApproval) {
          setStep("approving-underlying");
          setMessage("Approving deposit...");
          const approveHash = await chipToken.approveUnderlying(activeBuyIn);
          setTxHash(approveHash);
        }

        setStep("depositing");
        setMessage("Depositing chips...");
        const depositHash = await chipToken.deposit(activeBuyIn);
        setTxHash(depositHash);
      }

      if (needsGameApproval) {
        setStep("approving-game");
        setMessage("Approving table spend...");
        const approveHash = await chipToken.approveGame(activeBuyIn);
        setTxHash(approveHash);
      }

      if (!publicClient) throw new Error("No RPC client.");

      setStep("joining");
      setMessage("Joining table...");

      const joinHash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "sitDown",
        args: [{ x: viewerKey.x, y: viewerKey.y }],
      });
      setTxHash(joinHash);

      const joinReceipt = await publicClient.waitForTransactionReceipt({
        hash: joinHash,
        pollingInterval: 1_000,
      });
      if (joinReceipt.status !== "success") {
        // Infer the revert reason from known table state instead of relying on
        // RPC error strings which are often truncated or generic on SKALE.
        let revertReason = "Join reverted on-chain.";
        if (tablePhase !== null && tablePhase !== 0) {
          revertReason = "A hand is in progress. Wait for it to end before joining.";
        } else if (playerCount !== null && playerCount >= maxPlayers) {
          revertReason = "This table is full.";
        } else {
          // Fallback: try to extract a more specific reason from a replay call
          try {
            await publicClient.call({
              to: tableAddress,
              data: (await publicClient.getTransaction({ hash: joinHash })).input,
              account: address,
            });
          } catch (callErr) {
            const reason = callErr instanceof Error ? callErr.message : String(callErr);
            if (reason.includes("AlreadyJoined") || reason.includes("0x003b2682")) {
              revertReason = "You are already seated at this table.";
            } else if (reason.includes("GameIsFull") || reason.includes("0x07cc8ab8")) {
              revertReason = "This table is full.";
            } else if (reason.includes("GameInProgress") || reason.includes("0xd25f4344")) {
              revertReason = "A hand is in progress. Wait for it to end before joining.";
            } else if (reason.includes("ERC20") || reason.includes("insufficient") || reason.includes("allowance")) {
              revertReason = "Insufficient chip balance or approval. Deposit and approve chips before joining.";
            } else {
              revertReason = `Join reverted: ${reason}`;
            }
          }
        }
        throw new Error(revertReason);
      }

      setStep("done");
      onJoined?.(address);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Transaction failed");
      setStep("idle");
    }
  };

  const statusLabel = (() => {
    if (step === "claiming-faucet") return "Claiming MockSKL...";
    if (step === "approving-underlying") return "Approving Deposit...";
    if (step === "depositing") return "Depositing...";
    if (step === "approving-game") return "Approving Table...";
    if (step === "joining") return mode === "rejoin" ? "Restoring..." : "Joining...";
    if (step === "done") return mode === "rejoin" ? "Restored" : "Joined";
    return mode === "rejoin" ? "Restore Viewer Key" : "Join Table";
  })();

  const isBusy = step !== "idle" && step !== "done";

  return (
    <div className="w-full max-w-3xl">
      <div className="flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-poker-text-muted">
          {address ? (
            <>
              <Identicon address={address} size={16} />
              <span>{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
            </>
          ) : (
            <span>Connect wallet to join</span>
          )}
        </div>

        {isConnected ? (
          <button
            onClick={handleJoin}
            disabled={isBusy || step === "done"}
            className="rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-4 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusLabel}
          </button>
        ) : (
          <WalletConnectButton />
        )}

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

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 sm:text-left">
        {mode === "join" ? (
          <>
            <span>
              Buy-in:{" "}
              <span className="font-semibold text-poker-gold">
                {formatTokenDisplay(activeBuyIn)}
              </span>
            </span>
            {isConnected && !hasUnderlyingBalance && !hasChipBalance && step === "idle" && (
              <span className="text-poker-text-muted">MockSKL will be auto-claimed</span>
            )}
            {isConnected && hasUnderlyingBalance && (needsDepositApproval || needsGameApproval) && step === "idle" && (
              <span className="text-yellow-400">Requires approval</span>
            )}
            {isConnected && !hasChipBalance && hasUnderlyingBalance && (
              <span className="text-poker-text-muted">Deposit required</span>
            )}
          </>
        ) : null}
        {message && (
          <span className="text-poker-gold animate-pulse">{message}</span>
        )}
      </div>
    </div>
  );
}
