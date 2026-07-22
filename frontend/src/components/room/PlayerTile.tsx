import type { ReactNode } from "react";

import { cn } from "../../utils/className";
import { PlayerAvatar } from "./PlayerAvatar";

export type PlayerVisualState = "default" | "actor" | "counterparty" | "disabled";

interface PlayerTileProps {
  readonly disabled?: boolean;
  readonly avatarId?: string;
  readonly meta?: ReactNode;
  readonly nickname: string;
  readonly onClick?: () => void;
  readonly rightBadge?: ReactNode;
  readonly roleLabel?: string;
  readonly visualState?: PlayerVisualState;
}

export function PlayerTile({
  avatarId,
  disabled = false,
  meta,
  nickname,
  onClick,
  rightBadge,
  roleLabel,
  visualState,
}: PlayerTileProps) {
  const actualVisualState: PlayerVisualState = visualState ?? (disabled ? "disabled" : "default");

  return (
    <button
      className={cn(
        "min-h-16 rounded-md border px-3 py-2 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        actualVisualState === "actor"
          ? "border-emerald-600 bg-emerald-50 text-stone-950 ring-1 ring-emerald-200"
          : actualVisualState === "counterparty"
            ? "border-red-400 bg-red-50 text-stone-950 ring-1 ring-red-100"
            : actualVisualState === "disabled"
              ? "border-stone-200 bg-stone-100 text-stone-500 opacity-60"
              : "border-stone-200 bg-white text-stone-950 active:border-emerald-200 active:bg-emerald-50",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2">
          <PlayerAvatar avatarId={avatarId} nickname={nickname} size="sm" />
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate text-base",
                actualVisualState === "actor" || actualVisualState === "counterparty"
                  ? "font-bold"
                  : "font-semibold",
              )}
            >
              {nickname}
            </span>
            {roleLabel !== undefined ? (
              <span
                className={cn(
                  "mt-1 block truncate text-xs font-semibold",
                  actualVisualState === "actor"
                    ? "text-emerald-700"
                    : actualVisualState === "counterparty"
                      ? "text-red-700"
                      : "text-stone-500",
                )}
              >
                {roleLabel}
              </span>
            ) : null}
            {meta !== undefined ? (
              <span
                className={cn(
                  "mt-1 block truncate text-xs font-medium",
                  actualVisualState === "actor"
                    ? "text-emerald-700"
                    : actualVisualState === "counterparty"
                      ? "text-red-700"
                      : actualVisualState === "disabled"
                        ? "text-stone-500"
                        : "text-stone-500",
                )}
              >
                {meta}
              </span>
            ) : null}
          </span>
        </span>
        {rightBadge !== undefined ? <span className="shrink-0">{rightBadge}</span> : null}
      </span>
    </button>
  );
}
