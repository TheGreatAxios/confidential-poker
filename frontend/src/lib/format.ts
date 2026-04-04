export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatChips(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatBalance(amount: number, decimals = 2): string {
  if (amount < 0.01 && amount > 0) return `<$0.01`;
  return amount.toFixed(decimals);
}

// Card display helpers
export function getRankDisplay(rank: number): string {
  const ranks = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  return ranks[rank] || "?";
}

export function getSuitSymbol(suit: number): string {
  const suits = ["♠", "♥", "♦", "♣"];
  return suits[suit] || "?";
}

export function getSuitColor(suit: number): string {
  return suit === 1 || suit === 2 ? "text-red-500" : "text-gray-900";
}

export function getCardName(rank: number, suit: number): string {
  return `${getRankDisplay(rank)}${getSuitSymbol(suit)}`;
}

// Time formatting
export function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Percentage
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// Truncate address
export function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
