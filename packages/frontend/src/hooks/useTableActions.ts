import { useCallback, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { FRONTEND_CONFIG } from "@/lib/config";
import { POKER_GAME_ABI } from "@/lib/contracts";

type TableAction =
  | "fold"
  | "check"
  | "call"
  | "raise"
  | "dealNewHand"
  | "leaveTable"
  | "forfeitAndLeave"
  | "requestLeave"
  | "cancelLeave";

export function useTableActions(tableAddress: `0x${string}`) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [acting, setActing] = useState<TableAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (action: TableAction, args?: readonly [bigint]) => {
    if (acting) return null;
    setActing(action);
    setError(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: action,
        args,
      });
      if (!publicClient) throw new Error("No RPC client.");
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_000 });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
      return hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed.";
      setError(message);
      throw err;
    } finally {
      setActing(null);
    }
  }, [acting, publicClient, tableAddress, writeContractAsync]);

  return {
    acting,
    error,
    actions: {
      fold: () => send("fold"),
      check: () => send("check"),
      call: () => send("call"),
      raise: (amount: bigint) => send("raise", [amount]),
      dealNewHand: () => send("dealNewHand"),
      leaveTable: () => send("leaveTable"),
      forfeitAndLeave: () => send("forfeitAndLeave"),
      requestLeave: () => send("requestLeave"),
      cancelLeave: () => send("cancelLeave"),
    },
  };
}
