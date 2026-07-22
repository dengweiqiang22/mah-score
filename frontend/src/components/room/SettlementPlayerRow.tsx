import { cn } from "../../utils/className";

interface SettlementPlayerRowProps {
  readonly expense: number;
  readonly income: number;
  readonly isCurrentPlayer?: boolean;
  readonly isTopPlayer?: boolean;
  readonly nickname: string;
  readonly total: number;
}

export function SettlementPlayerRow({
  expense,
  income,
  isCurrentPlayer = false,
  isTopPlayer = false,
  nickname,
  total,
}: SettlementPlayerRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-100 px-1 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-semibold text-stone-950">{nickname}</p>
          {isCurrentPlayer ? (
            <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
              我
            </span>
          ) : null}
          {isTopPlayer ? (
            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              最高分
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-medium text-stone-500">
          收入 {income} · 支出 {expense}
        </p>
      </div>
      <p
        className={cn(
          "text-3xl font-semibold tabular-nums",
          total > 0 ? "text-emerald-700" : total < 0 ? "text-red-700" : "text-stone-500",
        )}
      >
        {total > 0 ? `+${total}` : total}
      </p>
    </div>
  );
}
