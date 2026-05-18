import { blo } from "blo";

interface IdenticonProps {
  address: string;
  size?: number;
  className?: string;
}

export function Identicon({ address, size = 20, className = "" }: IdenticonProps) {
  if (!address || !address.startsWith("0x")) return null;
  return (
    <img
      src={blo(address as `0x${string}`)}
      alt=""
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
