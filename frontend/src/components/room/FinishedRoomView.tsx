import type { ReactNode } from "react";

interface FinishedRoomViewProps {
  readonly children: ReactNode;
  readonly roomId: string;
  readonly totalRounds: number;
}

export function FinishedRoomView({ children, roomId, totalRounds }: FinishedRoomViewProps) {
  return (
    <section className="grid gap-3">
      <div className="px-1">
        <p className="text-sm font-semibold text-stone-500">房间 {roomId}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-stone-950">最终排名</h1>
        <p className="mt-1 text-sm text-stone-500">共 {totalRounds} 局</p>
      </div>
      {children}
    </section>
  );
}
