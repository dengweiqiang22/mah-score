import { cn } from "../../utils/className";

interface LedgerRowProps {
  readonly expense: number;
  readonly income: number;
  readonly isCurrentPlayer?: boolean;
  readonly nickname: string;
  readonly total: number;
}

export function LedgerRow({
  expense,
  income,
  isCurrentPlayer = false,
  nickname,
  total,
}: LedgerRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2",
        isCurrentPlayer ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-stone-50",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-stone-900">{nickname}</p>
          {isCurrentPlayer ? (
            <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              我
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-stone-500">
          收入 {income} · 支出 {expense}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-lg font-semibold tabular-nums", total >= 0 ? "text-emerald-700" : "text-red-700")}>
          {total >= 0 ? `+${total}` : total}
        </p>
        <p className="mt-1 text-xs font-medium text-stone-400">净变化</p>
      </div>
    </div>
  );
}
