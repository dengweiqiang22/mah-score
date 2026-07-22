import type { ReactNode } from "react";

import { cn } from "../../utils/className";

export type PlayerVisualState = "default" | "actor" | "counterparty" | "disabled";

interface PlayerTileProps {
  readonly disabled?: boolean;
  readonly meta: ReactNode;
  readonly nickname: string;
  readonly onClick?: () => void;
  readonly roleLabel?: string;
  readonly visualState?: PlayerVisualState;
}

export function PlayerTile({
  disabled = false,
  meta,
  nickname,
  onClick,
  roleLabel,
  visualState,
}: PlayerTileProps) {
  const metaNode: ReactNode = meta;
  const actualVisualState: PlayerVisualState = visualState ?? (disabled ? "disabled" : "default");

  return (
    <button
      className={cn(
        "min-h-16 rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed",
        actualVisualState === "actor"
          ? "border-emerald-600 bg-emerald-50 text-stone-950 ring-1 ring-emerald-200"
          : actualVisualState === "counterparty"
            ? "border-red-400 bg-red-50 text-stone-950 ring-1 ring-red-100"
            : actualVisualState === "disabled"
              ? "border-stone-200 bg-stone-100 text-stone-500 opacity-60"
              : "border-stone-200 bg-stone-100 text-stone-950",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
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
      <span
        className={cn(
          "mt-1 block text-sm font-medium",
          actualVisualState === "actor"
            ? "text-emerald-700"
            : actualVisualState === "counterparty"
              ? "text-red-700"
              : actualVisualState === "disabled"
                ? "text-stone-500"
                : "text-stone-600",
        )}
      >
        {metaNode}
      </span>
    </button>
  );
}
