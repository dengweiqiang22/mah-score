import { Undo2 } from "lucide-react";

import { cn } from "../../utils/className";
import { ScoreFlowLine } from "./ScoreFlowLine";

interface RecentEventRowProps {
  readonly detail: string;
  readonly flows: readonly {
    readonly delta: number;
    readonly nickname: string;
  }[];
  readonly flowSummary: string;
  readonly isLatest?: boolean;
  readonly isUndone: boolean;
  readonly isUndoDisabled: boolean;
  readonly onUndo: () => void;
  readonly title: string;
}

export function RecentEventRow({
  detail,
  flows,
  flowSummary,
  isLatest = false,
  isUndone,
  isUndoDisabled,
  onUndo,
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
        <p className="truncate text-sm font-semibold text-stone-900">{title}</p>
        <div className="mt-1">
          <ScoreFlowLine fallback={detail || flowSummary} flows={flows} isUndone={isUndone} />
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
