import type { ReactNode } from "react";

interface PlayingRoomViewProps {
  readonly children: ReactNode;
  readonly roomId: string;
  readonly roundNumber: number;
}

export function PlayingRoomView({ children, roomId, roundNumber }: PlayingRoomViewProps) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold text-stone-500">房间 {roomId}</p>
        <p className="text-sm font-semibold text-stone-500">第 {roundNumber} 局</p>
      </div>
      {children}
    </section>
  );
}
