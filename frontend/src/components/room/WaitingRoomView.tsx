import type { ReactNode } from "react";

interface WaitingRoomViewProps {
  readonly children: ReactNode;
  readonly roomId: string;
}

export function WaitingRoomView({ children, roomId }: WaitingRoomViewProps) {
  return (
    <section className="grid gap-3">
      <div className="px-1">
        <p className="text-sm font-semibold text-stone-500">房间 {roomId}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-stone-950">等待玩家</h1>
      </div>
      {children}
    </section>
  );
}
