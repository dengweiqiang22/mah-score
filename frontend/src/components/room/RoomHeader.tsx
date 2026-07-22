import { Home, MoreHorizontal } from "lucide-react";

import { cn } from "../../utils/className";

type SyncStatus = "idle" | "syncing" | "error";

interface RoomHeaderProps {
  readonly className?: string;
  readonly onHomeClick?: () => void;
  readonly onMoreClick?: () => void;
  readonly roomId: string;
  readonly roundNumber: number;
  readonly syncStatus: SyncStatus;
}

function getSyncLabel(syncStatus: SyncStatus): string | undefined {
  if (syncStatus === "syncing") {
    return "同步中";
  }

  if (syncStatus === "error") {
    return "同步失败";
  }

  return undefined;
}

export function RoomHeader({
  className,
  onHomeClick,
  onMoreClick,
  roomId,
  roundNumber,
  syncStatus,
}: RoomHeaderProps) {
  const syncLabel = getSyncLabel(syncStatus);

  return (
    <header className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 px-1", className)}>
      <button
        aria-label="回到首页"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-stone-200/70 text-stone-700 transition-colors active:bg-stone-300"
        onClick={onHomeClick}
        title="回到首页"
        type="button"
      >
        <Home className="h-5 w-5" />
      </button>
      <div className="min-w-0 text-center">
        <p className="truncate text-base font-semibold tracking-normal text-stone-950">
          房间 {roomId} · 第 {roundNumber} 局
        </p>
        {syncLabel !== undefined ? (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              syncStatus === "error" ? "text-red-700" : "text-stone-500",
            )}
          >
            {syncLabel}
          </p>
        ) : null}
      </div>
      <button
        aria-label="更多房间操作"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-stone-200/70 text-stone-700 transition-colors active:bg-stone-300"
        onClick={onMoreClick}
        type="button"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </header>
  );
}
