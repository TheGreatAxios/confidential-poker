import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_FACTORY_ABI } from "../abis/poker-factory";
import { POKER_GAME_ABI } from "../abis/poker-game";

const DEFAULT_BUY_IN = 1000n * 10n ** 18n;
const DEFAULT_SMALL_BLIND = 5n * 10n ** 18n;
const DEFAULT_BIG_BLIND = 10n * 10n ** 18n;
const DEFAULT_MAX_PLAYERS = 6n;

type SeatedTable = {
  address: Address;
  seat: number;
  phase: number;
};

async function findSeat(tableAddress: Address, playerAddress: Address): Promise<number> {
  const ks = getKeyStore();
  const playerCount = (await ks.readContract(tableAddress, POKER_GAME_ABI, "playerCount", [])) as bigint;

  for (let i = 0; i < Number(playerCount); i++) {
    const addr = (await ks.readContract(tableAddress, POKER_GAME_ABI, "getPlayer", [BigInt(i)])) as Address;
    if (addr.toLowerCase() === playerAddress.toLowerCase()) return i;
  }

  return -1;
}

async function leaveExtraTable(table: SeatedTable): Promise<void> {
  const ks = getKeyStore();
  const functionName = table.phase === 0 ? "leaveTable" : "requestLeave";

  try {
    if (functionName === "requestLeave") {
      const leaveRequested = (await ks.readContract(table.address, POKER_GAME_ABI, "isLeaveRequested", [
        ks.getAddress(),
      ])) as boolean;
      if (leaveRequested) return;
    }

    const data = encodeFunctionData({
      abi: POKER_GAME_ABI,
      functionName,
      args: [],
    });
    await ks.signAndSend(table.address, data);
    console.log(`${functionName} sent for old table ${table.address}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`Could not leave old table ${table.address}: ${msg}`);
  }
}

async function findExistingTable(tables: Address[], ourAddress: Address): Promise<Address | null> {
  const seatedTables: SeatedTable[] = [];

  for (const addr of tables) {
    try {
      const seat = await findSeat(addr, ourAddress);
      if (seat < 0) continue;

      const phase = (await getKeyStore().readContract(addr, POKER_GAME_ABI, "phase", [])) as number;
      seatedTables.push({ address: addr, seat, phase });
    } catch {
      continue;
    }
  }

  if (seatedTables.length === 0) return null;

  const preferred = seatedTables.find((table) => table.phase !== 0) ?? seatedTables[0];
  console.log(`Found existing seat: table=${preferred.address} seat=${preferred.seat} phase=${preferred.phase}`);

  for (const table of seatedTables) {
    if (table.address.toLowerCase() !== preferred.address.toLowerCase()) {
      await leaveExtraTable(table);
    }
  }

  return preferred.address;
}

export async function discoverOrCreate(): Promise<Address> {
  const ks = getKeyStore();
  const ourAddress = ks.getAddress();

  const tables = (await ks.readContract(
    config.factoryAddress,
    POKER_FACTORY_ABI,
    "getAllTables",
    [],
  )) as Address[];

  const existingTable = await findExistingTable(tables, ourAddress);
  if (existingTable) return existingTable;

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

  // Minimum: 11 * CTX_CALLBACK_VALUE_WEI (constructor requires minimumCtxReserve + 1 CTX payment)
  // The table auto-pulls more from factory via _ensureCTXReserve as needed
  const reserve = factoryCtxValue * 11n;
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
