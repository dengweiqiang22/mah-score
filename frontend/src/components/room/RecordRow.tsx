import { Undo2 } from "lucide-react";

import { Button } from "../ui/Button";
import { cn } from "../../utils/className";

interface RecordRowProps {
  readonly flowSummary: string;
  readonly isUndone: boolean;
  readonly isUndoDisabled: boolean;
  readonly onUndo: () => void;
  readonly title: string;
}

export function RecordRow({
  flowSummary,
  isUndone,
  isUndoDisabled,
  onUndo,
  title,
}: RecordRowProps) {
  return (
    <article className={cn("rounded-md bg-stone-100 px-3 py-2", isUndone ? "opacity-70" : "")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{title}</p>
          <p className={cn("mt-1 truncate text-xs font-semibold", isUndone ? "text-stone-500" : "text-stone-700")}>
            {flowSummary}
          </p>
        </div>
        {isUndone ? (
          <span className="shrink-0 text-xs font-semibold text-stone-500">已撤销</span>
        ) : (
          <Button className="shrink-0" disabled={isUndoDisabled} onClick={onUndo} size="sm" variant="danger">
            <Undo2 className="h-3.5 w-3.5" />
            撤销
          </Button>
        )}
      </div>
    </article>
  );
}
