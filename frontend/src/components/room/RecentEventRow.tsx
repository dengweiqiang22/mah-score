import { Undo2 } from "lucide-react";

import { cn } from "../../utils/className";

interface RecentEventRowProps {
  readonly flowSummary: string;
  readonly isLatest?: boolean;
  readonly isUndone: boolean;
  readonly isUndoDisabled: boolean;
  readonly onUndo: () => void;
  readonly title: string;
}

export function RecentEventRow({
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
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-100 py-2 last:border-b-0",
        isUndone ? "opacity-60" : "",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-stone-900">{title}</p>
        <p className="mt-1 truncate text-xs font-medium text-stone-500">{flowSummary}</p>
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
