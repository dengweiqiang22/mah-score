import { Undo2 } from "lucide-react";

import { Button } from "../ui/Button";
import { cn } from "../../utils/className";

interface RecordRowProps {
  readonly actionNumber: number;
  readonly detail: string;
  readonly flowSummary: string;
  readonly isUndone: boolean;
  readonly isUndoDisabled: boolean;
  readonly onUndo: () => void;
  readonly title: string;
}

export function RecordRow({
  actionNumber,
  detail,
  flowSummary,
  isUndone,
  isUndoDisabled,
  onUndo,
  title,
}: RecordRowProps) {
  return (
    <article className={cn("border-b border-stone-100 py-3 last:border-b-0", isUndone ? "opacity-60" : "")}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
          {actionNumber}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{title}</p>
          <p className="mt-1 truncate text-xs text-stone-400">{detail}</p>
        </div>
        {isUndone ? (
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-500">
            已撤销
          </span>
        ) : (
          <Button
            aria-label={`撤销第 ${actionNumber} 笔事件`}
            className="h-8 w-8 shrink-0 bg-red-50 px-0 text-red-700 active:bg-red-100"
            disabled={isUndoDisabled}
            onClick={onUndo}
            size="sm"
            variant="ghost"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <p
        className={cn(
          "ml-9 mt-2 truncate text-sm font-semibold",
          isUndone ? "text-stone-500" : "text-stone-700",
        )}
      >
        {flowSummary}
      </p>
    </article>
  );
}
