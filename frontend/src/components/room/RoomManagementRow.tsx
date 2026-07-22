import type { RoomPlayer } from "@mah-score/shared";

import { Pencil, Trash2 } from "lucide-react";

import { PlayerAvatar } from "./PlayerAvatar";

interface RoomManagementRowProps {
  readonly disabledRemove?: boolean;
  readonly onRemove: () => void;
  readonly onRename: () => void;
  readonly player: RoomPlayer;
}

export function RoomManagementRow({
  disabledRemove = false,
  onRemove,
  onRename,
  player,
}: RoomManagementRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar avatarId={player.avatarId} nickname={player.nickname} size="sm" />
        <p className="truncate text-sm font-semibold text-stone-900">{player.nickname}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          aria-label={`修改 ${player.nickname} 昵称`}
          className="grid h-9 w-9 place-items-center rounded-md bg-stone-100 text-stone-700 active:bg-stone-200"
          onClick={onRename}
          type="button"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          aria-label={`删除 ${player.nickname}`}
          className="grid h-9 w-9 place-items-center rounded-md bg-red-50 text-red-700 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabledRemove}
          onClick={onRemove}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
