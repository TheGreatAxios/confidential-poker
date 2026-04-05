"use client";

import type { Agent } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

interface AgentSeatProps {
  agent: Agent;
  isActive: boolean;
  position: string;
}

export function AgentSeat({ agent, isActive, position }: AgentSeatProps) {
  const positionClasses: Record<string, string> = {
    "top-left": "absolute top-2 left-4 sm:top-4 sm:left-8",
    "top-center": "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 sm:-translate-y-6",
    "top-right": "absolute top-2 right-4 sm:top-4 sm:right-8",
    "bottom-right": "absolute bottom-2 right-4 sm:bottom-4 sm:right-8",
    "bottom-center": "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 sm:translate-y-6",
    "bottom-left": "absolute bottom-2 left-4 sm:bottom-4 sm:left-8",
  };

  return (
    <div
      className={`${positionClasses[position] || ""} z-10 transition-all duration-300 ${
        isActive ? "scale-105" : ""
      }`}
    >
      <AgentAvatar agent={agent} />
    </div>
  );
}
