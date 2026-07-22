import type { ReactNode } from "react";

import { cn } from "../../utils/className";

interface EventActionProps {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly emphasis?: "default" | "primary" | "muted";
  readonly icon?: ReactNode;
  readonly isSelected?: boolean;
  readonly onClick: () => void;
}

export function EventAction({
  children,
  disabled = false,
  emphasis = "default",
  icon,
  isSelected = false,
  onClick,
}: EventActionProps) {
  return (
    <button
      className={cn(
        "grid min-h-14 place-items-center gap-1 rounded-md border px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        isSelected
          ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
          : emphasis === "primary"
            ? "border-emerald-200 bg-emerald-50 text-stone-950 active:bg-emerald-100"
            : emphasis === "muted"
              ? "border-stone-200 bg-white text-stone-600 active:bg-stone-50"
              : "border-stone-200 bg-stone-50 text-stone-900 active:bg-stone-100",
        disabled && !isSelected ? "opacity-50" : "",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon !== undefined ? (
        <span className={cn("text-current", emphasis === "primary" ? "opacity-90" : "opacity-70")}>
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
