import { cn } from "../../utils/className";

interface TaxRefundLineProps {
  readonly isUndone?: boolean;
  readonly taxRefunds?: readonly {
    readonly details: readonly {
      readonly delta: number;
      readonly label: string;
    }[];
    readonly nickname: string;
    readonly playerId: string;
  }[];
}

function getDeltaLabel(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function TaxRefundLine({ isUndone = false, taxRefunds = [] }: TaxRefundLineProps) {
  if (taxRefunds.length === 0) {
    return null;
  }

  return (
    <div className="mt-1.5 grid gap-1 text-xs font-medium text-stone-500">
      {taxRefunds.map((item) => (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" key={item.playerId}>
          <span className="font-semibold text-stone-600">{item.nickname} · 退税</span>
          {item.details.map((detail) => (
            <span
              className="inline-flex items-center gap-1"
              key={`${item.playerId}-${detail.label}-${detail.delta}`}
            >
              <span>{detail.label}</span>
              <span className={cn("tabular-nums", isUndone ? "text-stone-500" : "text-red-700")}>
                {getDeltaLabel(detail.delta)}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
