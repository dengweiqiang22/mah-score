import type { RoomPlayer } from "@mah-score/shared";

import { PlayerAvatar } from "./PlayerAvatar";

interface WaitingPlayerRowProps {
  readonly isCurrentPlayer?: boolean;
  readonly isOwner?: boolean;
  readonly player: RoomPlayer;
}

export function WaitingPlayerRow({
  isCurrentPlayer = false,
  isOwner = false,
  player,
}: WaitingPlayerRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-stone-100 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar
          avatarId={player.avatarId}
          isCurrentPlayer={isCurrentPlayer}
          nickname={player.nickname}
          size="sm"
        />
        <p className="truncate text-base font-semibold">{player.nickname}</p>
        {isCurrentPlayer ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            我
          </span>
        ) : null}
      </div>
      <span
        className={
          isOwner
            ? "shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100"
            : "shrink-0 text-xs font-medium text-stone-400"
        }
      >
        {isOwner ? "房主" : "玩家"}
      </span>
    </div>
  );
}
