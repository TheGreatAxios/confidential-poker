import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { FRONTEND_CONFIG } from "@/lib/config";
import { POKER_FACTORY_ABI, POKER_FACTORY_ADDRESS, isContractDeployed } from "@/lib/contracts";
import type { TableInfo } from "@/lib/types";
import { phaseFromContract } from "@/hooks/usePokerTable";

type TableInfoRead = readonly [bigint, bigint, bigint, bigint, bigint, number, string];

export function useFactory() {
  const factoryReady = isContractDeployed(POKER_FACTORY_ADDRESS);

  const {
    data: tableAddresses,
    isLoading: isLoadingTables,
    error: tableError,
    refetch: refetchTables,
  } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: POKER_FACTORY_ADDRESS,
    abi: POKER_FACTORY_ABI,
    functionName: "getAllTables",
    query: {
      enabled: factoryReady,
      refetchInterval: 10_000,
    },
  });

  const addresses = useMemo(
    () => (Array.isArray(tableAddresses) ? (tableAddresses as `0x${string}`[]) : []),
    [tableAddresses],
  );

  const {
    data: tableReads,
    isLoading: isLoadingInfo,
    error: infoError,
    refetch: refetchInfo,
  } = useReadContracts({
    contracts: addresses.map((address) => ({
      chainId: FRONTEND_CONFIG.chainId,
      address: POKER_FACTORY_ADDRESS,
      abi: POKER_FACTORY_ABI,
      functionName: "getTableInfo" as const,
      args: [address] as const,
    })),
    query: {
      enabled: factoryReady && addresses.length > 0,
      refetchInterval: 10_000,
    },
  });

  const tables = useMemo<TableInfo[]>(() => {
    return addresses.flatMap((address, index) => {
      const entry = tableReads?.[index];
      if (entry?.status !== "success") {
        return [];
      }

      const [buyIn, smallBlind, bigBlind, playerCount, pot, phaseValue, name] = entry.result as TableInfoRead;
      const phase = phaseFromContract(Number(phaseValue));
      return [{
        address,
        buyIn,
        smallBlind,
        bigBlind,
        playerCount: Number(playerCount),
        pot,
        phase,
        name,
        isActive: phase !== "waiting" || playerCount > 0n,
      }];
    });
  }, [addresses, tableReads]);

  return {
    tables,
    isLoading: isLoadingTables || isLoadingInfo,
    error: tableError?.message ?? infoError?.message ?? null,
    refetch: () => {
      void refetchTables();
      void refetchInfo();
    },
  };
}
