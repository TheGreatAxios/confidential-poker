import { formatUnits, parseUnits } from "viem";

export const TOKEN_DECIMALS = 18;
export const TOKEN_SYMBOL = "SKL";

export function formatTokenAmount(
  value: bigint,
  options?: {
    decimals?: number;
    maxFractionDigits?: number;
  },
): string {
  const decimals = options?.decimals ?? TOKEN_DECIMALS;
  const maxFractionDigits = options?.maxFractionDigits ?? 4;
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  const localizedWhole = BigInt(whole || "0").toLocaleString();

  return trimmedFraction ? `${localizedWhole}.${trimmedFraction}` : localizedWhole;
}

export function formatTokenDisplay(
  value: bigint,
  options?: {
    decimals?: number;
    maxFractionDigits?: number;
    symbol?: string;
  },
): string {
  const symbol = options?.symbol ?? TOKEN_SYMBOL;
  return `${formatTokenAmount(value, options)} ${symbol}`;
}

export function parseTokenAmount(
  value: string,
  decimals = TOKEN_DECIMALS,
): bigint | null {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    return parseUnits(normalized, decimals);
  } catch {
    return null;
  }
}
