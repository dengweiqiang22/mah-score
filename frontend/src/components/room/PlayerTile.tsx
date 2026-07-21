import type { ReactNode } from "react";

import { cn } from "../../utils/className";

interface PlayerTileProps {
  readonly disabled?: boolean;
  readonly isRelated?: boolean;
  readonly isSelected?: boolean;
  readonly meta: string;
  readonly nickname: string;
  readonly onClick?: () => void;
  readonly tone?: "default" | "muted";
}

export function PlayerTile({
  disabled = false,
  isRelated = false,
  isSelected = false,
  meta,
  nickname,
  onClick,
  tone = "default",
}: PlayerTileProps) {
  const metaNode: ReactNode = meta;

  return (
    <button
      className={cn(
        "min-h-16 rounded-md px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
        tone === "muted"
          ? "bg-stone-100 text-stone-400"
          : isSelected
            ? "bg-emerald-50 ring-2 ring-emerald-500"
            : isRelated
              ? "bg-red-50 ring-2 ring-red-300"
              : "bg-stone-100",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="block truncate text-base font-semibold">{nickname}</span>
      <span
        className={cn(
          "mt-1 block text-sm font-medium",
          tone === "muted"
            ? "text-stone-400"
            : isSelected
              ? "text-emerald-700"
              : isRelated
                ? "text-red-700"
                : "text-stone-500",
        )}
      >
        {metaNode}
      </span>
    </button>
  );
}
