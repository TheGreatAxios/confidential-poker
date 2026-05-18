import { useEffect, useState } from "react";

interface CountdownRingProps {
  isActive: boolean;
  duration?: number;
  size?: number;
}

export function CountdownRing({ isActive, duration = 30, size = 72 }: CountdownRingProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    if (!isActive) {
      setRemaining(duration);
      return;
    }
    setRemaining(duration);
    const interval = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, duration]);

  if (!isActive && remaining === duration) return null;

  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - remaining / duration);
  const isUrgent = remaining <= 5;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ margin: -4 }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(251,191,36,0.15)"
          strokeWidth={2}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isUrgent ? "#ef4444" : "#fbbf24"}
          strokeWidth={2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
    </div>
  );
}
