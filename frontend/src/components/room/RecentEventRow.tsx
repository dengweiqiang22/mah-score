import { Undo2 } from "lucide-react";

import { cn } from "../../utils/className";
import { ScoreFlowLine } from "./ScoreFlowLine";
import { TaxRefundLine } from "./TaxRefundLine";

interface RecentEventRowProps {
  readonly detail: string;
  readonly flows: readonly {
    readonly delta: number;
    readonly nickname: string;
  }[];
  readonly flowSummary: string;
  readonly isLatest?: boolean;
  readonly isUndone: boolean;
  readonly isTaxRefunded?: boolean;
  readonly isUndoDisabled: boolean;
  readonly onUndo: () => void;
  readonly taxRefunds?: readonly {
    readonly details: readonly {
      readonly delta: number;
      readonly label: string;
    }[];
    readonly nickname: string;
    readonly playerId: string;
  }[];
  readonly title: string;
}

export function RecentEventRow({
  detail,
  flows,
  flowSummary,
  isLatest = false,
  isUndone,
  isTaxRefunded = false,
  isUndoDisabled,
  onUndo,
  taxRefunds,
  title,
}: RecentEventRowProps) {
  return (
    <article
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border-l-4 px-3 py-3",
        isLatest ? "border-l-emerald-600 bg-emerald-50/60" : "border-l-stone-200 bg-stone-50",
        isUndone ? "opacity-60" : "",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-stone-900">{title}</p>
          {isTaxRefunded && !isUndone ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
              已退税
            </span>
          ) : null}
        </div>
        <div className="mt-1">
          <ScoreFlowLine fallback={detail || flowSummary} flows={flows} isUndone={isUndone} />
          <TaxRefundLine isUndone={isUndone} taxRefunds={taxRefunds} />
        </div>
      </div>
      {isUndone ? (
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-500">
          已撤销
        </span>
      ) : isLatest ? (
        <button
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold text-red-700 transition-colors active:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isUndoDisabled}
          onClick={onUndo}
          type="button"
        >
          <Undo2 className="h-3.5 w-3.5" />
          撤销
        </button>
      ) : (
        <span className="shrink-0 text-xs font-medium text-stone-400">最近</span>
      )}
    </article>
  );
}
