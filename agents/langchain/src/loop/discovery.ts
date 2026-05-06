import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_FACTORY_ABI } from "../abis/poker-factory";
import { POKER_GAME_ABI } from "../abis/poker-game";

const DEFAULT_BUY_IN = 1000n * 10n ** 18n;
const DEFAULT_SMALL_BLIND = 5n * 10n ** 18n;
const DEFAULT_BIG_BLIND = 10n * 10n ** 18n;
const DEFAULT_MAX_PLAYERS = 6n;

export async function discoverOrCreate(): Promise<Address> {
  const ks = getKeyStore();
  const ourAddress = ks.getAddress();

  const tables = (await ks.readContract(
    config.factoryAddress,
    POKER_FACTORY_ABI,
    "getAllTables",
    [],
  )) as Address[];

  for (const addr of tables) {
    try {
      const phase = (await ks.readContract(addr, POKER_GAME_ABI, "phase", [])) as number;
      if (phase !== 0) continue;

      const playerCount = (await ks.readContract(addr, POKER_GAME_ABI, "playerCount", [])) as bigint;
      const maxPlayers = (await ks.readContract(addr, POKER_GAME_ABI, "MAX_PLAYERS", [])) as bigint;
      if (playerCount >= maxPlayers) continue;

      const buyIn = (await ks.readContract(addr, POKER_GAME_ABI, "BUY_IN", [])) as bigint;
      if (buyIn !== DEFAULT_BUY_IN) continue;

      console.log(`Found open table: ${addr}`);
      return addr;
    } catch {
      continue;
    }
  }

  console.log("No open tables found, creating a new one...");
  const factoryCtxValue = (await ks.readContract(
    config.factoryAddress,
    POKER_FACTORY_ABI,
    "CTX_CALLBACK_VALUE_WEI",
    [],
  )) as bigint;

  const reserve = factoryCtxValue * 10n;
  const balance = await ks.getBalance(ourAddress);

  if (balance < reserve) {
    throw new Error(
      `Insufficient sFUEL for CTX reserve. Need ${reserve.toString()}, have ${balance.toString()}`,
    );
  }

  const data = encodeFunctionData({
    abi: POKER_FACTORY_ABI,
    functionName: "createTable",
    args: [DEFAULT_BUY_IN, DEFAULT_SMALL_BLIND, DEFAULT_BIG_BLIND, DEFAULT_MAX_PLAYERS, "Agent Table"],
  });

  const txHash = await ks.signAndSend(config.factoryAddress, data, reserve);
  console.log(`Table creation tx: ${txHash}`);

  const tableCount = (await ks.readContract(
    config.factoryAddress,
    POKER_FACTORY_ABI,
    "getTableCount",
    [],
  )) as bigint;

  const newTableAddr = (await ks.readContract(
    config.factoryAddress,
    POKER_FACTORY_ABI,
    "getTable",
    [tableCount - 1n],
  )) as Address;

  console.log(`Created table at ${newTableAddr}`);
  return newTableAddr;
}
