import { cn } from "../../utils/className";

interface ScoreFlowLineProps {
  readonly flows: readonly {
    readonly delta: number;
    readonly nickname: string;
  }[];
  readonly fallback: string;
  readonly isUndone?: boolean;
}

function getDeltaLabel(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function ScoreFlowLine({ fallback, flows, isUndone = false }: ScoreFlowLineProps) {
  if (flows.length === 0) {
    return <p className="truncate text-xs font-medium text-stone-500">{fallback}</p>;
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold">
      {flows.map((flow) => (
        <span className="inline-flex items-center gap-1" key={`${flow.nickname}-${flow.delta}`}>
          <span className="text-stone-700">{flow.nickname}</span>
          <span
            className={cn(
              "tabular-nums",
              isUndone
                ? "text-stone-500"
                : flow.delta > 0
                  ? "text-emerald-700"
                  : "text-red-700",
            )}
          >
            {getDeltaLabel(flow.delta)}
          </span>
        </span>
      ))}
    </div>
  );
}
