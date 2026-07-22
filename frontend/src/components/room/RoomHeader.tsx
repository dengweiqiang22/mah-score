import { MoreHorizontal } from "lucide-react";

import { cn } from "../../utils/className";

type SyncStatus = "idle" | "syncing" | "error";

interface RoomHeaderProps {
  readonly className?: string;
  readonly onMoreClick?: () => void;
  readonly roomId: string;
  readonly roundNumber: number;
  readonly syncStatus: SyncStatus;
  readonly version: number;
}

function getSyncLabel(syncStatus: SyncStatus, version: number): string {
  if (syncStatus === "syncing") {
    return "同步中";
  }

  if (syncStatus === "error") {
    return "同步失败";
  }

  return `已同步 v${version}`;
}

export function RoomHeader({
  className,
  onMoreClick,
  roomId,
  roundNumber,
  syncStatus,
  version,
}: RoomHeaderProps) {
  return (
    <header className={cn("flex items-center justify-between gap-3 px-1", className)}>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-normal text-stone-950">
          房间 {roomId} · 第 {roundNumber} 局
        </p>
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            syncStatus === "error" ? "text-red-700" : "text-stone-500",
          )}
        >
          {getSyncLabel(syncStatus, version)}
        </p>
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
