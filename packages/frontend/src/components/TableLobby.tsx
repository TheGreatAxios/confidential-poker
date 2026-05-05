import { useState } from "react";
import { useAccount } from "wagmi";
import { CreateTableModal } from "@/components/CreateTableModal";
import { useFactory } from "@/hooks/useFactory";
import { POKER_FACTORY_ADDRESS, isContractDeployed } from "@/lib/contracts";
import type { TableInfo } from "@/lib/types";
import { formatTokenDisplay } from "@/lib/token-format";

interface TableLobbyProps {
  onSelectTable: (tableAddress: `0x${string}`, tableInfo?: TableInfo) => void;
}

export function TableLobby({ onSelectTable }: TableLobbyProps) {
  const { isConnected } = useAccount();
  const { tables, isLoading, error, refetch } = useFactory();
  const [isCreating, setIsCreating] = useState(false);
  const factoryConfigured = isContractDeployed(POKER_FACTORY_ADDRESS);

  return (
    <div className="w-full max-w-6xl px-3 py-6 sm:px-4">
      <div className="mb-6 flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Poker Tables</h1>
          <p className="mt-2 max-w-2xl text-sm text-poker-text-muted sm:text-base">
            Browse live rooms, pick the stakes, or open a new table for the next hand.
          </p>
          {!factoryConfigured && (
            <p className="mt-3 rounded-xl border border-poker-red/25 bg-poker-red/10 px-3 py-2 text-sm text-poker-red">
              Factory address is not configured. Set VITE_POKER_FACTORY_ADDRESS.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.08]">
            Refresh
          </button>
          <button
            onClick={() => setIsCreating(true)}
            disabled={!isConnected || !factoryConfigured}
            className="rounded-xl border border-poker-gold/30 bg-poker-gold/20 px-4 py-3 text-sm font-bold text-poker-gold hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Table
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-poker-red/25 bg-poker-red/10 px-3 py-2 text-sm text-poker-red">{error}</p>}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-[26px] border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : tables.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => (
            <button
              key={table.address}
              onClick={() => onSelectTable(table.address, table)}
              className="group rounded-[26px] border border-white/10 bg-[#101820]/80 p-5 text-left shadow-[0_20px_70px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:border-poker-gold/35 hover:bg-[#14231f]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-white">{table.name || "Unnamed Table"}</div>
                  <div className="mt-1 font-mono text-xs text-poker-text-dim">{table.address.slice(0, 8)}...{table.address.slice(-6)}</div>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                  {table.phase}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-poker-text-dim">Buy-in</div>
                  <div className="mt-1 font-mono text-sm font-bold text-poker-gold">{formatTokenDisplay(table.buyIn)}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-poker-text-dim">Players</div>
                  <div className="mt-1 font-mono text-sm font-bold text-white">{table.playerCount}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-poker-text-dim">Blinds</div>
                  <div className="mt-1 font-mono text-sm font-bold text-white">{formatTokenDisplay(table.smallBlind)} / {formatTokenDisplay(table.bigBlind)}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-poker-text-dim">Pot</div>
                  <div className="mt-1 font-mono text-sm font-bold text-white">{formatTokenDisplay(table.pot)}</div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-poker-gold/25 bg-poker-gold/10 px-4 py-3 text-center text-sm font-bold text-poker-gold transition-colors group-hover:bg-poker-gold/20">
                Join Table
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
          <div className="text-2xl font-bold text-white">No tables yet.</div>
          <p className="mt-2 text-sm text-poker-text-muted">Create the first room once the factory address is configured.</p>
        </div>
      )}

      {isCreating && (
        <CreateTableModal
          onClose={() => setIsCreating(false)}
          onCreated={(tableAddress) => {
            setIsCreating(false);
            onSelectTable(tableAddress);
          }}
        />
      )}
    </div>
  );
}
