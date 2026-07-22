import { Undo2 } from "lucide-react";

import { cn } from "../../utils/className";
import { ScoreFlowLine } from "./ScoreFlowLine";
import { TaxRefundLine } from "./TaxRefundLine";

interface RecordRowProps {
  readonly actionNumber: number;
  readonly detail: string;
  readonly flows: readonly {
    readonly delta: number;
    readonly nickname: string;
  }[];
  readonly flowSummary: string;
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

export function RecordRow({
  actionNumber,
  detail,
  flows,
  flowSummary,
  isUndone,
  isTaxRefunded = false,
  isUndoDisabled,
  onUndo,
  taxRefunds,
  title,
}: RecordRowProps) {
  return (
    <article
      className={cn(
        "rounded-md bg-stone-50 px-3 py-3 ring-1 ring-stone-100",
        isUndone ? "opacity-60" : "",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-stone-500 ring-1 ring-stone-200">
          {actionNumber}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">
            {flows.length === 0 ? `${title} · ${detail}` : title}
          </p>
          {flows.length > 0 || (isTaxRefunded && !isUndone) ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {flows.length > 0 ? (
                <p className="min-w-0 truncate text-xs text-stone-400">{detail}</p>
              ) : null}
              {isTaxRefunded && !isUndone ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                  已退税
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {isUndone ? (
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-500">
            已撤销
          </span>
        ) : (
          <button
            aria-label={`撤销第 ${actionNumber} 笔事件`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-red-200 bg-red-100 text-red-700 transition-colors active:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isUndoDisabled}
            onClick={onUndo}
            type="button"
          >
            <Undo2 className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="ml-9 mt-2">
        <ScoreFlowLine fallback={flowSummary} flows={flows} isUndone={isUndone} />
        <TaxRefundLine isUndone={isUndone} taxRefunds={taxRefunds} />
      </div>
    </article>
  );
}
