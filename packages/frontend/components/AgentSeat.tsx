"use client";

import type { Agent } from "@/lib/types";
import type { SeatPosition } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

interface AgentSeatProps {
  agent: Agent;
  isActive: boolean;
  position: SeatPosition;
}

const POSITION_CLASSES: Record<SeatPosition, string> = {
  "top-left": "absolute left-[4%] top-[6%] sm:left-[8%] sm:top-[8%]",
  "top-center": "absolute left-1/2 top-[2%] -translate-x-1/2 -translate-y-3 sm:top-[3%] sm:-translate-y-5",
  "top-right": "absolute right-[4%] top-[6%] sm:right-[8%] sm:top-[8%]",
  "bottom-right": "absolute bottom-[8%] right-[4%] sm:bottom-[10%] sm:right-[8%]",
  "bottom-center": "absolute bottom-[4%] left-1/2 -translate-x-1/2 translate-y-3 sm:bottom-[5%] sm:translate-y-5",
  "bottom-left": "absolute bottom-[8%] left-[4%] sm:bottom-[10%] sm:left-[8%]",
};

export function AgentSeat({ agent, isActive, position }: AgentSeatProps) {
  return (
    <div
      className={`${POSITION_CLASSES[position]} z-10 transition-all duration-300 ${
        isActive ? "scale-105" : ""
      }`}
    >
      <AgentAvatar agent={agent} />
    </div>
  );
}
