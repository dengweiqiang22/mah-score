import type { ReactNode } from "react";
import type { RoomPlayer } from "@mah-score/shared";

import { RoomHeader } from "./RoomHeader";
import { RoomScoreStrip } from "./RoomScoreStrip";

interface PlayingRoomViewProps {
  readonly children: ReactNode;
  readonly currentPlayerId?: string;
  readonly onMoreClick?: () => void;
  readonly players: readonly RoomPlayer[];
  readonly roomId: string;
  readonly roundNumber: number;
  readonly scores: ReadonlyMap<string, number>;
  readonly syncStatus: "idle" | "syncing" | "error";
  readonly version: number;
}

export function PlayingRoomView({
  children,
  currentPlayerId,
  onMoreClick,
  players,
  roomId,
  roundNumber,
  scores,
  syncStatus,
  version,
}: PlayingRoomViewProps) {
  return (
    <section className="grid gap-3">
      <RoomHeader
        onMoreClick={onMoreClick}
        roomId={roomId}
        roundNumber={roundNumber}
        syncStatus={syncStatus}
        version={version}
      />
      <RoomScoreStrip currentPlayerId={currentPlayerId} players={players} scores={scores} />
      {children}
    </section>
  );
}
