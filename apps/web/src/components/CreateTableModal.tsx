import { useEffect, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { FRONTEND_CONFIG } from "@/lib/config";
import { POKER_FACTORY_ABI, POKER_FACTORY_ADDRESS } from "@/lib/contracts";
import { formatTokenDisplay, parseTokenAmount } from "@/lib/token-format";

interface CreateTableModalProps {
  onClose: () => void;
  onCreated: (tableAddress: `0x${string}`) => void;
}

type TxStep = "idle" | "creating" | "done";

export function CreateTableModal({ onClose, onCreated }: CreateTableModalProps) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [tableName, setTableName] = useState("Midnight Felt");
  const [buyInInput, setBuyInInput] = useState("100");
  const [smallBlindInput, setSmallBlindInput] = useState("1");
  const [bigBlindInput, setBigBlindInput] = useState("2");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [ctxReserveInput, setCtxReserveInput] = useState("0.01");
  const [step, setStep] = useState<TxStep>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const smallBlind = parseTokenAmount(smallBlindInput);
    if (smallBlind && bigBlindInput === "") {
      setBigBlindInput((Number(smallBlindInput) * 2).toString());
    }
  }, [bigBlindInput, smallBlindInput]);

  const buyIn = parseTokenAmount(buyInInput);
  const smallBlind = parseTokenAmount(smallBlindInput);
  const bigBlind = parseTokenAmount(bigBlindInput);
  const canSubmit = !!tableName.trim() && !!buyIn && !!smallBlind && !!bigBlind && bigBlind > smallBlind;

  const handleCreate = async () => {
    if (!canSubmit || !buyIn || !smallBlind || !bigBlind) return;
    setStep("creating");
    setError(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_FACTORY_ADDRESS,
        abi: POKER_FACTORY_ABI,
        functionName: "createTable",
        args: [buyIn, smallBlind, bigBlind, BigInt(maxPlayers), tableName.trim()],
        value: parseEther(ctxReserveInput || "0"),
      });

      if (!publicClient) throw new Error("No RPC client.");
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_000 });
      if (receipt.status !== "success") throw new Error("Create table reverted on-chain.");

      const createdLog = receipt.logs.find((log) => log.address.toLowerCase() === POKER_FACTORY_ADDRESS.toLowerCase());
      const createdTable = createdLog?.topics[1]
        ? `0x${createdLog.topics[1].slice(-40)}` as `0x${string}`
        : null;

      setStep("done");
      if (createdTable) {
        onCreated(createdTable);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create table failed.");
      setStep("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#10161f]/95 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Create Table</h2>
            <p className="mt-1 text-sm text-poker-text-muted">Set the stakes and open a new multiplayer room.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 px-3 py-1 text-sm text-poker-text-muted hover:text-white">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-poker-text-dim">Name</span>
            <input value={tableName} onChange={(event) => setTableName(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-poker-gold/50" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-poker-text-dim">Buy-in</span>
            <input value={buyInInput} onChange={(event) => setBuyInInput(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-white outline-none focus:border-poker-gold/50" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-poker-text-dim">Max Players</span>
            <select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-poker-gold/50">
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-poker-text-dim">Small Blind</span>
            <input value={smallBlindInput} onChange={(event) => setSmallBlindInput(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-white outline-none focus:border-poker-gold/50" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-poker-text-dim">Big Blind</span>
            <input value={bigBlindInput} onChange={(event) => setBigBlindInput(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-white outline-none focus:border-poker-gold/50" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-poker-text-dim">CTX Reserve</span>
            <input value={ctxReserveInput} onChange={(event) => setCtxReserveInput(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 font-mono text-white outline-none focus:border-poker-gold/50" />
          </label>
        </div>

        {buyIn && (
          <div className="mt-4 rounded-xl border border-poker-gold/20 bg-poker-gold/10 px-3 py-2 text-sm text-poker-gold">
            New table buy-in: {formatTokenDisplay(buyIn)}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-poker-red">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={!canSubmit || step === "creating"}
          className="mt-5 w-full rounded-xl border border-poker-gold/30 bg-poker-gold/20 px-4 py-3 text-sm font-bold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step === "creating" ? "Creating..." : "Create Table"}
        </button>
      </div>
    </div>
  );
}
