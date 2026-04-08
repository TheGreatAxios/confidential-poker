
import type { Agent } from "@/lib/types";
import type { SeatPosition } from "@/lib/types";
import { AgentAvatar } from "./AgentAvatar";

interface AgentSeatProps {
  agent: Agent;
  isActive: boolean;
  position: SeatPosition;
}

const POSITION_CLASSES: Record<SeatPosition, string> = {
  "top-left": "absolute left-[3%] top-[4%] sm:left-[7%] sm:top-[5%]",
  "top-center": "absolute left-1/2 top-[-1%] -translate-x-1/2 -translate-y-5 sm:top-0 sm:-translate-y-8",
  "top-right": "absolute right-[3%] top-[4%] sm:right-[7%] sm:top-[5%]",
  "bottom-right": "absolute bottom-[8%] right-[4%] sm:bottom-[10%] sm:right-[8%]",
  "bottom-center": "absolute bottom-[4%] left-1/2 -translate-x-1/2 translate-y-3 sm:bottom-[5%] sm:translate-y-5",
  "bottom-left": "absolute bottom-[8%] left-[4%] sm:bottom-[10%] sm:left-[8%]",
};

export function AgentSeat({ agent, isActive, position }: AgentSeatProps) {
  return (
    <div
      className={`${POSITION_CLASSES[position]} z-10 transition-all duration-300 ${
        isActive ? "scale-[1.12]" : "scale-100"
      }`}
    >
      <AgentAvatar agent={agent} />
    </div>
  );
}
