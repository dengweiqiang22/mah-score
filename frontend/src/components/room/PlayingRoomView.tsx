import type { ReactNode } from "react";
import type { RoomPlayer } from "@mah-score/shared";

import { RoomHeader } from "./RoomHeader";
import { RoomScoreStrip } from "./RoomScoreStrip";

interface PlayingRoomViewProps {
  readonly children: ReactNode;
  readonly currentPlayerId?: string;
  readonly onHomeClick?: () => void;
  readonly onMoreClick?: () => void;
  readonly players: readonly RoomPlayer[];
  readonly roomId: string;
  readonly roundNumber: number;
  readonly scores: ReadonlyMap<string, number>;
  readonly syncStatus: "idle" | "syncing" | "error";
}

export function PlayingRoomView({
  children,
  currentPlayerId,
  onHomeClick,
  onMoreClick,
  players,
  roomId,
  roundNumber,
  scores,
  syncStatus,
}: PlayingRoomViewProps) {
  return (
    <section className="grid gap-3">
      <RoomHeader
        onHomeClick={onHomeClick}
        onMoreClick={onMoreClick}
        roomId={roomId}
        roundNumber={roundNumber}
        syncStatus={syncStatus}
      />
      <RoomScoreStrip currentPlayerId={currentPlayerId} players={players} scores={scores} />
      {children}
    </section>
  );
}
