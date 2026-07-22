import type { ScoreFan } from "@mah-score/shared";

import { cn } from "../../utils/className";

interface FanSelectorProps {
  readonly disabled?: boolean;
  readonly fans: readonly ScoreFan[];
  readonly onSelectFan: (fan: ScoreFan) => void;
  readonly selectedFan?: ScoreFan;
}

export function FanSelector({
  disabled = false,
  fans,
  onSelectFan,
  selectedFan,
}: FanSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {fans.map((fan) => {
        const isSelected = selectedFan === fan;

        return (
          <button
            className={cn(
              "h-11 rounded-md border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
              isSelected
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-stone-50 text-stone-900 active:bg-stone-100",
              disabled && !isSelected ? "opacity-45" : "",
            )}
            disabled={disabled}
            key={fan}
            onClick={() => {
              onSelectFan(fan);
            }}
            type="button"
          >
            {fan} 番
          </button>
        );
      })}
    </div>
  );
}
